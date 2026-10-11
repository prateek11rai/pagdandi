import { BUDGET_RANGES, DAY_RANGES, type TrekFilters } from "./filters";
import type { Trek } from "./trek-schema";

// One row of the /treks table. Plain data, so the table can filter it in the browser.
export interface TrekRow {
  slug: string;
  name: string;
  area: string | null;
  state: string;
  region: string;
  difficulty: string;
  days: number | null;
  highestAltitudeM: number | null;
  seasonMonths: number[];
  budgetMinInr: number;
  budgetMaxInr: number;
  audioUrl: string | null;
  weak: string[]; // fields with a weak_sources note
}

export function trekRow(t: Trek, audioUrl: string | null): TrekRow {
  return {
    slug: t.slug,
    name: t.name,
    area: t.area,
    state: t.state,
    region: t.region,
    difficulty: t.difficulty,
    days: t.days,
    highestAltitudeM: t.highest_point.altitude_m,
    seasonMonths: t.season_months,
    budgetMinInr: t.budget_inr.min,
    budgetMaxInr: t.budget_inr.max,
    audioUrl,
    weak: (t.weak_sources ?? []).map((w) => w.field),
  };
}

export type TableFilters = Pick<TrekFilters, "q" | "region" | "month" | "days" | "difficulty" | "budget">;

// The same rules as the SQL filters in treks.ts; the name filter is a plain substring match.
export function filterRows(rows: TrekRow[], f: TableFilters): TrekRow[] {
  const name = f.q?.trim().toLowerCase();
  const days = f.days ? DAY_RANGES[f.days] : undefined;
  const budget = f.budget ? BUDGET_RANGES[f.budget] : undefined;
  return rows.filter((r) => {
    const mid = (r.budgetMinInr + r.budgetMaxInr) / 2;
    return (
      (!name || r.name.toLowerCase().includes(name)) &&
      (!f.region || r.region === f.region) &&
      (!f.month || r.seasonMonths.includes(f.month)) &&
      (!f.difficulty || r.difficulty === f.difficulty) &&
      (!days || (r.days !== null && r.days >= days[0] && r.days <= days[1])) &&
      (!budget || (mid >= budget[0] && mid <= budget[1]))
    );
  });
}
