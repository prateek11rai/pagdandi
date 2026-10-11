import { z } from "zod";
import { DIFFICULTIES, REGIONS, BUDGET_BANDS, type Region, type BudgetBand } from "./trek-schema";

export const DAY_BANDS = { "1": "Day hike", "2-3": "2–3 days", "4-6": "4–6 days", "7+": "7+ days" } as const;
export type DayBand = keyof typeof DAY_BANDS;
export const DAY_RANGES: Record<DayBand, [number, number]> = { "1": [1, 1], "2-3": [2, 3], "4-6": [4, 6], "7+": [7, 30] };
// Budget bands go by the middle of a trek's estimate.
export const BUDGET_RANGES: Record<BudgetBand, [number, number]> = {
  "under-5k": [0, 4999],
  "5k-10k": [5000, 9999],
  "10k-15k": [10000, 14999],
  "over-15k": [15000, 10_000_000],
};

// Search params from the URL. Anything unknown is dropped rather than rejected.
export const filtersSchema = z.object({
  q: z.string().trim().max(200).optional().catch(undefined),
  region: z.enum(Object.keys(REGIONS) as [Region, ...Region[]]).optional().catch(undefined),
  month: z.coerce.number().int().min(1).max(12).optional().catch(undefined),
  days: z.enum(Object.keys(DAY_BANDS) as [DayBand, ...DayBand[]]).optional().catch(undefined),
  difficulty: z.enum(DIFFICULTIES).optional().catch(undefined),
  budget: z.enum(Object.keys(BUDGET_BANDS) as [BudgetBand, ...BudgetBand[]]).optional().catch(undefined),
  // Used by the trek guide: the group's hard limits.
  maxDays: z.coerce.number().int().min(1).max(30).optional().catch(undefined),
  maxDifficulty: z.enum(DIFFICULTIES).optional().catch(undefined),
  maxBudgetInr: z.coerce.number().int().min(0).optional().catch(undefined),
});
export type TrekFilters = z.infer<typeof filtersSchema>;

export function parseFilters(params: Record<string, string | string[] | undefined>): TrekFilters {
  const flat = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v === "" ? undefined : v]),
  );
  return filtersSchema.parse(flat);
}
