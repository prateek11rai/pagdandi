import { z } from "zod";

export const REGIONS = {
  uttarakhand: "Uttarakhand",
  himachal: "Himachal Pradesh",
  kashmir: "Jammu & Kashmir",
  "sikkim-darjeeling": "Sikkim & Darjeeling",
  northeast: "Northeast",
  sahyadri: "Sahyadris",
  "western-ghats-south": "Western Ghats (south)",
} as const;
export type Region = keyof typeof REGIONS;

export const DIFFICULTIES = ["easy", "moderate", "difficult"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

// Facts that must be backed by a source whenever they are not null.
const SOURCED_FIELDS = [
  "highest_point",
  "start",
  "end",
  "days",
  "distance_km",
  "season_months",
  "permits",
  "last_mobile_signal",
  "getting_there",
  "name_local",
] as const;
type SourcedField = (typeof SOURCED_FIELDS)[number];

const altitude = z.number().int().min(0).max(8900).nullable();
const km = z.number().min(0).max(500).nullable();
const isoDate = z.iso.date();

const place = z.strictObject({
  name: z.string().min(1),
  lat: z.number().min(6).max(37.5),
  lon: z.number().min(68).max(97.5),
  altitude_m: altitude,
  coords_source: z.enum(["osm", "wikipedia"]),
});

const day = z.strictObject({
  day: z.number().int().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  camp_altitude_m: altitude,
  max_altitude_m: altitude,
  distance_km: km,
});

const source = z.strictObject({
  url: z.url({ protocol: /^https$/ }),
  title: z.string().min(1),
  accessed: isoDate,
  supports: z.array(z.string().regex(/^[a-z_]+(\.day\d+)?$/)).min(1),
});

// A fact we keep although its only source is weak (operator-style copy, an uncited list, dated pages).
// `field` uses the names from `supports`; the note is written for readers, so the page can show it.
const weakSource = z.strictObject({
  field: z.string().regex(/^[a-z_]+(\.day\d+)?$/),
  note: z.string().min(1).max(200),
});

const photo = z.strictObject({
  file_url: z.url({ protocol: /^https$/, hostname: /^upload\.wikimedia\.org$/ }),
  page_url: z.url({ protocol: /^https$/, hostname: /^commons\.wikimedia\.org$/ }),
  author: z.string().min(1),
  licence: z.string().min(1),
  licence_url: z.url({ protocol: /^https$/ }),
});

export const trekSchema = z
  .strictObject({
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    name: z.string().min(1),
    name_local: z.strictObject({ text: z.string().min(1), lang: z.string().regex(/^[a-z]{2,3}$/) }).nullable(),
    state: z.string().min(1),
    region: z.enum(Object.keys(REGIONS) as [Region, ...Region[]]),
    area: z.string().min(1).nullable(),
    difficulty: z.enum(DIFFICULTIES),
    days: z.number().int().min(1).max(30).nullable(),
    distance_km: km,
    highest_point: z.strictObject({ name: z.string().min(1), altitude_m: altitude }),
    start: place,
    end: place,
    getting_there: z.strictObject({
      railhead: z.strictObject({ name: z.string().min(1), distance_km: km }).nullable(),
      airport: z
        .strictObject({ name: z.string().min(1), iata: z.string().regex(/^[A-Z]{3}$/).nullable(), distance_km: km })
        .nullable(),
      road_head: z.string().min(1).nullable(),
      notes: z.string().min(1).nullable(),
    }),
    season_months: z.array(z.number().int().min(1).max(12)),
    permits: z.string().min(1).nullable(),
    last_mobile_signal: z.string().min(1).nullable(),
    budget_inr: z.strictObject({
      min: z.number().int().min(0),
      max: z.number().int().min(0),
      basis: z.string().startsWith("Pagdandi rough estimate:"),
    }),
    itinerary: z.array(day),
    highlights: z.array(z.string().min(1)).min(1).max(6),
    audio_script: z.string().min(1).nullable(),
    photo: photo.nullable(),
    weak_sources: z.array(weakSource).default([]),
    sources: z.array(source).min(1),
    facts_checked_by: z.string().min(1).nullable(),
    last_reviewed: isoDate,
  })
  .superRefine((t, ctx) => {
    const issue = (message: string, path: (string | number)[] = []) => ctx.addIssue({ code: "custom", message, path });
    const supported = new Set(t.sources.flatMap((s) => s.supports));

    for (const field of SOURCED_FIELDS) {
      const value = t[field];
      if (!hasFact(value)) continue;
      if (!supported.has(field)) issue(`${field} has a value but no source lists it in supports`, [field]);
    }
    t.itinerary.forEach((d, i) => {
      if (d.day !== i + 1) issue(`itinerary days must be numbered 1..n (found ${d.day} at position ${i + 1})`, ["itinerary", i]);
      const hasNumber = d.camp_altitude_m !== null || d.max_altitude_m !== null || d.distance_km !== null;
      if (hasNumber && !supported.has(`itinerary.day${d.day}`) && !supported.has("itinerary")) {
        issue(`itinerary day ${d.day} has numbers but no source lists itinerary.day${d.day}`, ["itinerary", i]);
      }
    });

    const flagged = new Set<string>();
    t.weak_sources.forEach((w, i) => {
      if (flagged.has(w.field)) issue(`weak_sources lists ${w.field} twice`, ["weak_sources", i]);
      flagged.add(w.field);
      if (!pointsAtFact(t, w.field)) issue(`weak_sources points at ${w.field}, which is null or not a sourced fact`, ["weak_sources", i]);
    });

    if (t.days !== null && t.itinerary.length > 0 && t.days !== t.itinerary.length) {
      issue(`days is ${t.days} but the itinerary has ${t.itinerary.length} days`, ["days"]);
    }
    if (t.budget_inr.min > t.budget_inr.max) issue("budget_inr.min is above max", ["budget_inr"]);

    const top = t.highest_point.altitude_m;
    if (top !== null) {
      const others = [t.start.altitude_m, t.end.altitude_m, ...t.itinerary.flatMap((d) => [d.camp_altitude_m, d.max_altitude_m])];
      for (const a of others) {
        if (a !== null && a > top) issue(`an altitude (${a} m) is above highest_point (${top} m)`, ["highest_point"]);
      }
      if (top > 4000 && t.difficulty === "easy") issue("a trek above 4,000 m cannot be graded easy", ["difficulty"]);
    }
    if (new Set(t.season_months).size !== t.season_months.length) issue("season_months has duplicates", ["season_months"]);
    if (t.audio_script && wordCount(t.audio_script) > 90) issue("audio_script is over 90 words", ["audio_script"]);
  });

export type Trek = z.infer<typeof trekSchema>;

function pointsAtFact(t: { itinerary: unknown[] } & Record<SourcedField, unknown>, field: string): boolean {
  if (field === "itinerary") return t.itinerary.length > 0;
  const day = /^itinerary\.day(\d+)$/.exec(field);
  if (day) return Number(day[1]) >= 1 && Number(day[1]) <= t.itinerary.length;
  return (SOURCED_FIELDS as readonly string[]).includes(field) && hasFact(t[field as SourcedField]);
}

function hasFact(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.values(value).some((v) => typeof v === "number" || hasFact(v));
  return true;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function budgetBand(min: number, max: number): BudgetBand {
  const mid = (min + max) / 2;
  if (mid < 5000) return "under-5k";
  if (mid < 10000) return "5k-10k";
  if (mid < 15000) return "10k-15k";
  return "over-15k";
}

export const BUDGET_BANDS = {
  "under-5k": "Under ₹5k",
  "5k-10k": "₹5k–10k",
  "10k-15k": "₹10k–15k",
  "over-15k": "Over ₹15k",
} as const;
export type BudgetBand = keyof typeof BUDGET_BANDS;

export const ALTITUDE_SAFETY_THRESHOLD_M = 3500;
