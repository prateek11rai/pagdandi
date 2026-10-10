import { z } from "zod";
import { DIFFICULTIES, REGIONS, BUDGET_BANDS, type Region, type BudgetBand } from "./trek-schema";

export const DAY_BANDS = { "1": "Day hike", "2-3": "2–3 days", "4-6": "4–6 days", "7+": "7+ days" } as const;
export type DayBand = keyof typeof DAY_BANDS;

// Search params from the URL. Anything unknown is dropped rather than rejected.
export const filtersSchema = z.object({
  q: z.string().trim().max(200).optional().catch(undefined),
  region: z.enum(Object.keys(REGIONS) as [Region, ...Region[]]).optional().catch(undefined),
  month: z.coerce.number().int().min(1).max(12).optional().catch(undefined),
  days: z.enum(Object.keys(DAY_BANDS) as [DayBand, ...DayBand[]]).optional().catch(undefined),
  difficulty: z.enum(DIFFICULTIES).optional().catch(undefined),
  budget: z.enum(Object.keys(BUDGET_BANDS) as [BudgetBand, ...BudgetBand[]]).optional().catch(undefined),
});
export type TrekFilters = z.infer<typeof filtersSchema>;

export function parseFilters(params: Record<string, string | string[] | undefined>): TrekFilters {
  const flat = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v === "" ? undefined : v]),
  );
  return filtersSchema.parse(flat);
}
