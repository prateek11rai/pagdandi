import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { sql } from "./db";
import type { Trek } from "./trek-schema";
import type { TrekFilters } from "./filters";

export interface TrekCard {
  slug: string;
  name: string;
  state: string;
  region: string;
  difficulty: string;
  days: number | null;
  highestAltitudeM: number | null;
  seasonMonths: number[];
  budgetMinInr: number;
  budgetMaxInr: number;
  audioUrl: string | null;
}

interface CardRow {
  slug: string;
  name: string;
  state: string;
  region: string;
  difficulty: string;
  days: number | null;
  highest_altitude_m: number | null;
  season_months: number[];
  budget_min_inr: number;
  budget_max_inr: number;
}

export function audioUrl(slug: string, lang = "en"): string | null {
  const file = `${slug}.${lang}.mp3`;
  return existsSync(path.join(process.cwd(), "public", "audio", file)) ? `/audio/${file}` : null;
}

function toCard(r: CardRow): TrekCard {
  return {
    slug: r.slug,
    name: r.name,
    state: r.state,
    region: r.region,
    difficulty: r.difficulty,
    days: r.days,
    highestAltitudeM: r.highest_altitude_m,
    seasonMonths: r.season_months,
    budgetMinInr: r.budget_min_inr,
    budgetMaxInr: r.budget_max_inr,
    audioUrl: audioUrl(r.slug),
  };
}

// Filters shared by listing and search. Every value is a bound parameter.
const DAY_RANGES: Record<string, [number, number]> = { "1": [1, 1], "2-3": [2, 3], "4-6": [4, 6], "7+": [7, 30] };
const BUDGET_RANGES: Record<string, [number, number]> = {
  "under-5k": [0, 4999],
  "5k-10k": [5000, 9999],
  "10k-15k": [10000, 14999],
  "over-15k": [15000, 10_000_000],
};

export function filterClause(f: TrekFilters) {
  const db = sql();
  const days = f.days ? DAY_RANGES[f.days] : undefined;
  const budget = f.budget ? BUDGET_RANGES[f.budget] : undefined;
  return db`
    ${f.region ? db`and t.region = ${f.region}` : db``}
    ${f.month ? db`and ${f.month}::int = any(t.season_months)` : db``}
    ${f.difficulty ? db`and t.difficulty = ${f.difficulty}` : db``}
    ${days ? db`and t.days between ${days[0]} and ${days[1]}` : db``}
    ${budget ? db`and (t.budget_min_inr + t.budget_max_inr) / 2 between ${budget[0]} and ${budget[1]}` : db``}
  `;
}

export async function listTreks(f: TrekFilters = {}): Promise<TrekCard[]> {
  const db = sql();
  const rows = await db<CardRow[]>`
    select slug, name, state, region, difficulty, days, highest_altitude_m, season_months, budget_min_inr, budget_max_inr
    from treks t
    where true ${filterClause(f)}
    order by name
  `;
  return rows.map(toCard);
}

export async function getCards(slugs: string[]): Promise<TrekCard[]> {
  if (slugs.length === 0) return [];
  const db = sql();
  const rows = await db<CardRow[]>`
    select slug, name, state, region, difficulty, days, highest_altitude_m, season_months, budget_min_inr, budget_max_inr
    from treks t where slug = any(${slugs})
  `;
  const bySlug = new Map(rows.map((r) => [r.slug, toCard(r)]));
  return slugs.flatMap((s) => bySlug.get(s) ?? []);
}

export async function getTrek(slug: string): Promise<Trek | null> {
  const db = sql();
  const [row] = await db<{ data: Trek }[]>`select data from treks where slug = ${slug}`;
  return row?.data ?? null;
}

export async function allSlugs(): Promise<string[]> {
  const db = sql();
  const rows = await db<{ slug: string }[]>`select slug from treks order by slug`;
  return rows.map((r) => r.slug);
}
