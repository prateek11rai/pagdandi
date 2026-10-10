// Checks numbers in the model's prose against database facts. Plain code, no model.
// A claim that doesn't match the trek it's about (or the user's own numbers) is replaced.

export interface TrekFacts {
  slug: string;
  names: string[]; // lowercase names a sentence might use
  altitudesM: number[];
  days: number[];
  distancesKm: number[];
  budget: { min: number; max: number };
}

export interface FactContext {
  treks: TrekFacts[];
  // Treks this turn's tools returned; used when a sentence names no trek.
  contextSlugs: string[];
  // Numbers the user typed (their budget, group size, days) may be repeated back.
  userNumbers: number[];
}

export const REPLACEMENT = "(see the card)";
const ALLOWED_ALTITUDES = [3500]; // the altitude-safety threshold we quote ourselves

type Kind = "altitude" | "feet" | "distance" | "days" | "nights" | "cost";

const NUM = String.raw`(\d{1,3}(?:,\d{2,3})+|\d+(?:\.\d+)?)`;
const PATTERNS: [Kind, RegExp][] = [
  ["cost", new RegExp(String.raw`(?:₹|\bRs\.?\s*|\bINR\s*)\s?${NUM}\s*(k|thousand|lakh)?\b`, "gi")],
  ["cost", new RegExp(String.raw`\b${NUM}\s*(k|thousand)?\s*(?:rupees|rs\b)`, "gi")],
  ["feet", new RegExp(String.raw`\b${NUM}\s*(?:ft|feet|foot)\b`, "gi")],
  ["altitude", new RegExp(String.raw`\b${NUM}\s*(?:m|mtrs?|metres?|meters?)\b(?!\s*(?:ft|feet))`, "gi")],
  ["distance", new RegExp(String.raw`\b${NUM}\s*(?:km|kms|kilometres?|kilometers?)\b`, "gi")],
  ["days", new RegExp(String.raw`\b${NUM}(?:\s*-\s*|\s+)(?:days?)\b`, "gi")],
  ["nights", new RegExp(String.raw`\b${NUM}(?:\s*-\s*|\s+)(?:nights?)\b`, "gi")],
];

function toNumber(raw: string, suffix?: string): number {
  const n = Number(raw.replace(/,/g, ""));
  const s = suffix?.toLowerCase();
  if (s === "k" || s === "thousand") return n * 1000;
  if (s === "lakh") return n * 100_000;
  return n;
}

function matches(kind: Kind, value: number, t: TrekFacts): boolean {
  switch (kind) {
    case "altitude":
      return t.altitudesM.some((a) => Math.abs(a - value) <= 20);
    case "feet":
      return t.altitudesM.some((a) => Math.abs(a - value * 0.3048) <= 30);
    case "distance":
      return t.distancesKm.some((d) => Math.abs(d - value) <= Math.max(0.6, d * 0.05));
    case "days":
      return t.days.includes(value);
    case "nights":
      return t.days.some((d) => d - 1 === value);
    case "cost":
      return value >= t.budget.min - 500 && value <= t.budget.max + 500;
  }
}

function treksFor(sentence: string, ctx: FactContext): TrekFacts[] {
  const lower = sentence.toLowerCase();
  const named = ctx.treks.filter((t) => t.names.some((n) => lower.includes(n)));
  if (named.length > 0) return named;
  const inContext = ctx.treks.filter((t) => ctx.contextSlugs.includes(t.slug));
  return inContext.length > 0 ? inContext : ctx.treks;
}

export function checkSentence(sentence: string, ctx: FactContext): { text: string; replaced: number } {
  const treks = treksFor(sentence, ctx);
  const spans: { start: number; end: number }[] = [];
  for (const [kind, re] of PATTERNS) {
    for (const m of sentence.matchAll(re)) {
      const start = m.index!;
      const end = start + m[0].length;
      if (spans.some((s) => start < s.end && end > s.start)) continue; // already judged by an earlier pattern
      const value = toNumber(m[1]!, m[2]);
      const ok =
        ctx.userNumbers.includes(value) ||
        (kind === "altitude" && ALLOWED_ALTITUDES.includes(value)) ||
        treks.some((t) => matches(kind, value, t));
      if (!ok) spans.push({ start, end });
      else spans.push({ start: end, end }); // zero-width marker: keeps later patterns off this span
    }
  }
  const bad = spans.filter((s) => s.end > s.start).sort((a, b) => b.start - a.start);
  let text = sentence;
  for (const s of bad) text = text.slice(0, s.start) + REPLACEMENT + text.slice(s.end);
  return { text, replaced: bad.length };
}

export function userNumbersFrom(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/(\d{1,3}(?:,\d{2,3})+|\d+(?:\.\d+)?)\s*(k|thousand|lakh)?/gi)) {
    out.push(toNumber(m[1]!, m[2]));
  }
  return out;
}

// Splits streamed text at sentence ends so each sentence is checked once, whole.
export class SentenceBuffer {
  private pending = "";
  push(delta: string): string[] {
    this.pending += delta;
    const out: string[] = [];
    for (;;) {
      const m = /[.!?](?=\s)|\n/.exec(this.pending);
      if (!m) break;
      const cut = m.index + m[0].length;
      out.push(this.pending.slice(0, cut));
      this.pending = this.pending.slice(cut);
    }
    return out;
  }
  flush(): string {
    const rest = this.pending;
    this.pending = "";
    return rest;
  }
}
