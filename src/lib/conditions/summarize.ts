import { generateText, type LanguageModel } from "ai";
import { z } from "zod";
import type { NewsItem, NewsSummary } from "./types";

const reply = z.object({
  bullets: z.array(z.object({ item: z.number().int().min(0), text: z.string().min(3).max(240) })).max(3),
});

// Gemma picks up to three items that matter to a trekker and rephrases each in one line.
// Links and dates always come from the item, never from the model, and a bullet may not
// contain a number its headline doesn't have; otherwise we fall back to the headline.
export async function summariseNews(model: LanguageModel, trekName: string, items: NewsItem[]): Promise<NewsSummary> {
  if (items.length === 0) return { bullets: [] };
  const list = items.map((it, i) => `${i}. ${it.title} (${it.source ?? "unknown source"}, ${it.date ?? "no date"})`).join("\n");
  const { text } = await generateText({
    model,
    temperature: 0,
    maxOutputTokens: 300,
    providerOptions: { ollama: { reasoningEffort: "none" } },
    prompt: `These are news headlines that matched a search for the ${trekName} trek in India.
Pick at most 3 that matter to someone about to do this trek: closures, landslides, snowfall, weather warnings, permit or fee changes, rescues. Ignore anything else.
For each, write one short plain sentence based only on the headline. Do not add facts that are not in the headline.
Reply with JSON only, like {"bullets":[{"item":0,"text":"..."}]}. If none matter, reply {"bullets":[]}.

${list}`,
  });
  const parsed = reply.safeParse(extractJson(text));
  if (!parsed.success) return { bullets: [] };
  const seen = new Set<number>();
  return {
    bullets: parsed.data.bullets
      .filter((b) => b.item < items.length && !seen.has(b.item) && seen.add(b.item))
      .map((b) => {
        const it = items[b.item]!;
        return { text: numbersWithin(b.text, it.title) ? b.text : it.title, url: it.url, date: it.date, source: it.source };
      }),
  };
}

function extractJson(text: string): unknown {
  const m = /\{[\s\S]*\}/.exec(text);
  try {
    return m ? JSON.parse(m[0]) : null;
  } catch {
    return null;
  }
}

export function numbersWithin(text: string, source: string): boolean {
  const nums = (s: string) => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(/,/g, ""));
  const allowed = new Set(nums(source));
  return nums(text).every((n) => allowed.has(n));
}
