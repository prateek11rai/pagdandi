import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { cityCoords, rankByOrigin } from "@/lib/cities";
import { formatSeason } from "@/lib/format";
import { searchTreks } from "@/lib/search";
import { DIFFICULTIES, REGIONS, type Difficulty, type Region } from "@/lib/trek-schema";
import type { TrekCard } from "@/lib/treks";

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

export function floorAtModerate(d: Difficulty): Difficulty {
  return d === "easy" ? "moderate" : d;
}

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
    from: z.string().max(60).optional().describe("The city the group starts from, e.g. Delhi"),
  }),
  execute: async ({ query, region, month, maxDifficulty, maxDays, maxBudgetInr, from }) => {
    const origin = cityCoords(from);
    // Our "easy" grade is strict (under 3,000 m, nothing technical). A group asking for something easy still fits
    // most moderate treks, so the ceiling never goes below moderate; Gemma tends to pass "easy" for any day hike.
    const ceiling = maxDifficulty ? floorAtModerate(maxDifficulty) : undefined;
    // Hard limits are SQL filters, so both sides of the hybrid search rank only treks that fit.
    const { cards } = await searchTreks(query, { region, month, maxDifficulty: ceiling, maxDays, maxBudgetInr }, 10);
    if (cards.length > 0) return { treks: rankByOrigin(cards, origin).slice(0, 5).map(summary) };
    // Nothing fits every limit: offer the closest matches and say so.
    const loose = await searchTreks(query, { region }, 10);
    return {
      treks: rankByOrigin(loose.cards, origin).slice(0, 3).map(summary),
      relaxed: "No trek fits every constraint. These are the closest matches; say which constraint they miss.",
    };
  },
});
