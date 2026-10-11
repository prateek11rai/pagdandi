import type { UIMessageChunk } from "ai";
import { orderBySearch, searchRanking } from "./card-order";
import { rankByOrigin } from "./cities";
import { checkSentence, SentenceBuffer, type FactContext } from "./fact-check";
import { copiesInstructions, instructionRuns, LEAK_REPLY, words } from "./instruction-leak";

// Re-emits the agent's UI stream with every text sentence checked before it leaves the server: one that copies the
// instructions becomes a fixed reply, and the rest are fact-checked. The recommended cards follow the search's
// ranking, nearest first when the group named its city.
export function factCheckedStream(
  source: ReadableStream<UIMessageChunk>,
  base: Omit<FactContext, "contextSlugs">,
  opts: { instructions: string; origin?: [number, number] | null },
): ReadableStream<UIMessageChunk> {
  const contextSlugs: string[] = [];
  const buffers = new Map<string, SentenceBuffer>();
  const toolNames = new Map<string, string>();
  const runs = instructionRuns(opts.instructions);
  let ranked: string[] = [];
  let sent: string[] = []; // the last words sent, across sentences and text parts
  let held = ""; // a list marker ("2.") waits for the sentence after it, so a copied list leaves no stray numbers
  let leaking = false;
  const ctx = () => ({ ...base, contextSlugs });
  const factCheck = (text: string) => (text.trim() ? checkSentence(text, ctx()).text : text);
  const send = (out: string) => {
    sent = [...sent, ...words(out)].slice(-7);
    return out;
  };
  const check = (text: string) => {
    if (!/\p{L}/u.test(text)) {
      held += text;
      return "";
    }
    const before = held;
    held = "";
    if (copiesInstructions(sent, text, runs)) {
      // A run of copied sentences becomes one reply, not the same line over and over.
      const out = leaking ? "" : /^\s*/.exec(before || text)![0] + LEAK_REPLY + /\s*$/.exec(text)![0];
      leaking = true;
      return send(out);
    }
    leaking = false;
    return send(factCheck(before) + factCheck(text));
  };
  const release = () => {
    const out = leaking ? "" : factCheck(held);
    held = "";
    return send(out);
  };

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
          for (const sentence of b.push(chunk.delta)) {
            const delta = check(sentence);
            if (delta) out.enqueue({ ...chunk, delta });
          }
        } else if (chunk.type === "text-end") {
          const rest = buffers.get(chunk.id)?.flush() ?? "";
          const delta = (rest ? check(rest) : "") + release();
          if (delta) out.enqueue({ type: "text-delta", id: chunk.id, delta });
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
