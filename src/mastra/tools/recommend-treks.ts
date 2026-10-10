import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { checkSentence } from "@/lib/fact-check";
import { allTrekFacts } from "@/lib/trek-facts";
import { getCards } from "@/lib/treks";

// The model picks slugs and says why; the cards the user sees are built from the database here.
export const recommendTreksTool = createTool({
  id: "recommend-treks",
  description:
    "Show 1 to 3 recommended trek cards to the user. Use slugs from search-treks results only. Each reason is one short sentence without numbers.",
  inputSchema: z.object({
    recommendations: z
      .array(z.object({ slug: z.string().regex(/^[a-z0-9-]{2,60}$/), reason: z.string().min(3).max(200) }))
      .min(1)
      .max(3),
  }),
  execute: async ({ recommendations }) => {
    const slugs = [...new Set(recommendations.map((r) => r.slug))];
    const cards = await getCards(slugs);
    const known = new Set(cards.map((c) => c.slug));
    const treks = await allTrekFacts();
    const reason = (r: { slug: string; reason: string }) =>
      checkSentence(r.reason, { treks, contextSlugs: [r.slug], userNumbers: [] }).text;
    return {
      cards,
      reasons: Object.fromEntries(recommendations.filter((r) => known.has(r.slug)).map((r) => [r.slug, reason(r)])),
      unknownSlugs: slugs.filter((s) => !known.has(s)),
    };
  },
});
