import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getLatestConditions } from "@/lib/conditions/store";
import { weatherLabel } from "@/lib/conditions/weather-codes";

// Reads conditions the daily job already stored. Never calls a paid API.
export const getConditionsTool = createTool({
  id: "get-conditions",
  description: "Get the latest stored forecast and news summary for a trek (checked by our daily job).",
  inputSchema: z.object({ slug: z.string().regex(/^[a-z0-9-]{2,60}$/) }),
  execute: async ({ slug }) => {
    const c = await getLatestConditions(slug);
    if (!c.forecast && !c.news) return { note: "Not checked yet. Say so; do not guess conditions." };
    return {
      forecastCheckedAt: c.forecast?.fetchedAt.toISOString() ?? null,
      forecast:
        c.forecast?.payload.places.map((p) => ({
          place: p.place === "road_head" ? `road head (${p.name})` : `high point (${p.name}, estimate)`,
          next2Days: p.days.slice(0, 2).map((d) => ({
            date: d.date,
            sky: weatherLabel(d.code),
            minC: d.tminC,
            maxC: d.tmaxC,
            snowCm: d.snowCm,
          })),
        })) ?? null,
      news: c.news?.summary?.bullets.length ? c.news.summary.bullets : "No new reports found.",
    };
  },
});
