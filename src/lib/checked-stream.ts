import type { UIMessageChunk } from "ai";
import { orderBySearch, searchRanking } from "./card-order";
import { rankByOrigin } from "./cities";
import { checkSentence, SentenceBuffer, type FactContext } from "./fact-check";

// Re-emits the agent's UI stream with every text sentence fact-checked before it leaves the server,
// and the recommended cards in the search's ranking, nearest first when the group named its city.
export function factCheckedStream(
  source: ReadableStream<UIMessageChunk>,
  base: Omit<FactContext, "contextSlugs">,
  opts: { origin?: [number, number] | null } = {},
): ReadableStream<UIMessageChunk> {
  const contextSlugs: string[] = [];
  const buffers = new Map<string, SentenceBuffer>();
  const toolNames = new Map<string, string>();
  let ranked: string[] = [];
  const ctx = () => ({ ...base, contextSlugs });
  const check = (text: string) => (text ? checkSentence(text, ctx()).text : text);

  return source.pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      transform(chunk, out) {
        if (chunk.type === "tool-input-start" || chunk.type === "tool-input-available") {
          toolNames.set(chunk.toolCallId, chunk.toolName);
          out.enqueue(chunk);
        } else if (chunk.type === "tool-output-available") {
          collectSlugs(chunk.output, contextSlugs);
          const tool = toolNames.get(chunk.toolCallId);
          if (tool === "searchTreks") ranked = searchRanking(chunk.output);
          out.enqueue(tool === "recommendTreks" ? { ...chunk, output: withCardsInOrder(chunk.output, ranked, opts.origin ?? null) } : chunk);
        } else if (chunk.type === "text-delta") {
          let b = buffers.get(chunk.id);
          if (!b) buffers.set(chunk.id, (b = new SentenceBuffer()));
          for (const sentence of b.push(chunk.delta)) out.enqueue({ ...chunk, delta: check(sentence) });
        } else if (chunk.type === "text-end") {
          const rest = buffers.get(chunk.id)?.flush() ?? "";
          if (rest) out.enqueue({ type: "text-delta", id: chunk.id, delta: check(rest) });
          buffers.delete(chunk.id);
          out.enqueue(chunk);
        } else {
          out.enqueue(chunk);
        }
      },
    }),
  );
}

// The model may leave out the group's city when it searches; the group's own words still count.
function withCardsInOrder(output: unknown, ranked: string[], origin: [number, number] | null): unknown {
  const o = output as { cards?: unknown } | null;
  if (!o || !Array.isArray(o.cards)) return output;
  const cards = orderBySearch(o.cards as { slug: string; start?: [number, number] }[], ranked);
  const placed = cards.every((c) => Array.isArray(c.start)) ? rankByOrigin(cards as { slug: string; start: [number, number] }[], origin) : cards;
  return { ...o, cards: placed };
}

function collectSlugs(output: unknown, into: string[]) {
  const visit = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.slug === "string" && !into.includes(o.slug)) into.push(o.slug);
      Object.values(o).forEach(visit);
    }
  };
  visit(output);
}
