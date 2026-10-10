import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { formatSeason } from "@/lib/format";
import { searchTreks } from "@/lib/search";
import { DIFFICULTIES, REGIONS, type Region } from "@/lib/trek-schema";
import type { TrekCard } from "@/lib/treks";

const RANK = { easy: 0, moderate: 1, difficult: 2 } as const;

const summary = (c: TrekCard) => ({
  slug: c.slug,
  name: c.name,
  state: c.state,
  difficulty: c.difficulty,
  days: c.days,
  highestM: c.highestAltitudeM,
  season: formatSeason(c.seasonMonths),
  budgetInr: `${c.budgetMinInr}-${c.budgetMaxInr} (trek only, from railhead; estimate)`,
});

export const searchTreksTool = createTool({
  id: "search-treks",
  description:
    "Search Pagdandi's trek database by meaning (e.g. 'snow trek in December'). Returns up to 5 treks with facts from the database. Always call this before recommending.",
  inputSchema: z.object({
    query: z.string().min(2).max(200).describe("The kind of trek wanted, in plain words"),
    region: z.enum(Object.keys(REGIONS) as [Region, ...Region[]]).optional(),
    month: z.coerce.number().int().min(1).max(12).optional().describe("Travel month, 1-12"),
    maxDifficulty: z.enum(DIFFICULTIES).optional().describe("moderate when some of the group are first-timers"),
    maxDays: z.coerce.number().int().min(1).max(30).optional(),
    maxBudgetInr: z.coerce.number().int().min(0).optional().describe("Per person, for the trek itself"),
  }),
  execute: async ({ query, region, month, maxDifficulty, maxDays, maxBudgetInr }) => {
    const { cards } = await searchTreks(query, { region }, 20);
    const fits = (c: TrekCard) =>
      (month === undefined || c.seasonMonths.includes(month)) &&
      (maxDifficulty === undefined || RANK[c.difficulty as keyof typeof RANK] <= RANK[maxDifficulty]) &&
      (maxDays === undefined || c.days === null || c.days <= maxDays) &&
      (maxBudgetInr === undefined || c.budgetMinInr <= maxBudgetInr);
    const fit = cards.filter(fits);
    if (fit.length > 0) return { treks: fit.slice(0, 5).map(summary) };
    // Nothing fits every constraint: offer the closest matches and say so.
    return {
      treks: cards.slice(0, 3).map(summary),
      relaxed: "No trek fits every constraint. These are the closest matches; say which constraint they miss.",
    };
  },
});
