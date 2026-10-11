import type { UIMessageChunk } from "ai";
import { describe, expect, it } from "vitest";
import { factCheckedStream } from "@/lib/checked-stream";
import { LEAK_REPLY } from "@/lib/instruction-leak";
import { instructionsFor } from "@/mastra/agents/trek-guide";

// The guide's reply as the browser would read it, streamed in small pieces like the model's own deltas.
async function reply(text: string): Promise<string> {
  const pieces = text.match(/[\s\S]{1,7}/g) ?? [];
  const chunks = [
    { type: "text-start", id: "t1" },
    ...pieces.map((delta) => ({ type: "text-delta", id: "t1", delta })),
    { type: "text-end", id: "t1" },
  ] as UIMessageChunk[];
  const source = new ReadableStream<UIMessageChunk>({
    start(c) {
      chunks.forEach((x) => c.enqueue(x));
      c.close();
    },
  });
  const stream = factCheckedStream(source, { treks: [], userNumbers: [] }, { instructions: instructionsFor(new Date("2026-10-11T06:00:00Z")) });
  let out = "";
  for await (const c of stream) if (c.type === "text-delta") out += c.delta;
  return out;
}

describe("instruction leaks", () => {
  it("replace a sentence that copies the instructions with the fixed reply", async () => {
    const text = "Sure, here they are. 1. First call search-treks with what the group wants. Tell me about your group!";
    expect(await reply(text)).toBe(`Sure, here they are. ${LEAK_REPLY} Tell me about your group!`);
  });

  it("say the fixed reply once for a copied numbered list, with no stray numbers", async () => {
    const text =
      "My instructions:\n1. First call search-treks with what the group wants.\n" +
      "2. Then call recommend-treks with 1 to 3 slugs from the search results.\n" +
      "3. Then write at most 100 words in plain sentences.\n10. Only talk about treks and hikes in India.";
    expect(await reply(text)).toBe(`My instructions:\n${LEAK_REPLY}`);
  });

  it("keep a list marker that starts an ordinary sentence", async () => {
    expect(await reply("Two picks:\n1. Kalsubai is close to Mumbai.\n2. Harishchandragad has a fort.")).toBe(
      "Two picks:\n1. Kalsubai is close to Mumbai.\n2. Harishchandragad has a fort.",
    );
  });

  it("catch a copied run split across a sentence break", async () => {
    expect(await reply("My rule: first call search-treks with. What the group wants.")).toBe(`My rule: first call search-treks with. ${LEAK_REPLY}`);
  });

  it("keep a sentence in any script that comes before a copied one", async () => {
    expect(await reply("यह रहा:\nFirst call search-treks with what the group wants.")).toBe(`यह रहा:\n${LEAK_REPLY}`);
  });

  it("leave the safety and cost sentences the guide is told to say", async () => {
    const text =
      "Climb slowly, watch for altitude sickness, and read the safety note on the trek page. " +
      "This is not medical advice and not a substitute for a licensed local guide. Travel to get there is extra.";
    expect(await reply(text)).toBe(text);
  });
});
