import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { formatSeason } from "@/lib/format";
import { getTrek } from "@/lib/treks";

export const getTrekTool = createTool({
  id: "get-trek",
  description: "Get one trek's details from the database: itinerary, permits, getting there, last mobile signal.",
  inputSchema: z.object({ slug: z.string().regex(/^[a-z0-9-]{2,60}$/) }),
  execute: async ({ slug }) => {
    const t = await getTrek(slug);
    if (!t) return { error: `No trek with slug ${slug}` };
    const g = t.getting_there;
    return {
      slug: t.slug,
      name: t.name,
      page: `/treks/${t.slug}`,
      difficulty: t.difficulty,
      days: t.days,
      highest: { name: t.highest_point.name, m: t.highest_point.altitude_m },
      season: formatSeason(t.season_months),
      budgetInr: `${t.budget_inr.min}-${t.budget_inr.max} (estimate)`,
      roadHead: g.road_head,
      railhead: g.railhead?.name ?? null,
      airport: g.airport?.name ?? null,
      permits: t.permits,
      lastMobileSignal: t.last_mobile_signal,
      itinerary: t.itinerary.map((d) => ({ day: d.day, from: d.from, to: d.to, campM: d.camp_altitude_m })),
      highlights: t.highlights.slice(0, 3),
    };
  },
});
