import type { UIMessageChunk } from "ai";
import { describe, expect, it } from "vitest";
import { orderBySearch } from "@/lib/card-order";
import { cityIn } from "@/lib/cities";
import { factCheckedStream } from "@/lib/checked-stream";

const card = (slug: string) => ({ slug });

describe("card order", () => {
  it("follows the search's ranking, with unranked cards last in the model's order", () => {
    expect(orderBySearch([card("c"), card("x"), card("a"), card("y")], ["a", "b", "c"]).map((c) => c.slug)).toEqual(["a", "c", "x", "y"]);
  });

  it("is applied to the recommendTreks output as it streams from the server", async () => {
    const chunks = [
      { type: "tool-input-available", toolCallId: "s1", toolName: "searchTreks", input: {} },
      { type: "tool-output-available", toolCallId: "s1", output: { treks: [{ slug: "dayara-bugyal" }, { slug: "sandakphu" }, { slug: "nongriat-root-bridges" }] } },
      { type: "tool-input-available", toolCallId: "r1", toolName: "recommendTreks", input: {} },
      {
        type: "tool-output-available",
        toolCallId: "r1",
        output: { cards: [card("sandakphu"), card("nongriat-root-bridges"), card("dayara-bugyal")], reasons: {} },
      },
    ] as unknown as UIMessageChunk[];
    const source = new ReadableStream<UIMessageChunk>({
      start(c) {
        chunks.forEach((x) => c.enqueue(x));
        c.close();
      },
    });
    const out: UIMessageChunk[] = [];
    for await (const c of factCheckedStream(source, { treks: [], userNumbers: [] }, { instructions: "" })) out.push(c);
    const rec = out.at(-1) as { output: { cards: { slug: string }[] } };
    expect(rec.output.cards.map((c) => c.slug)).toEqual(["dayara-bugyal", "sandakphu", "nongriat-root-bridges"]);
  });

  it("puts the treks nearest the group's own city first, even when the search didn't know it", async () => {
    const at = (slug: string, start: [number, number]) => ({ slug, start });
    const chunks = [
      { type: "tool-input-available", toolCallId: "s1", toolName: "searchTreks", input: {} },
      { type: "tool-output-available", toolCallId: "s1", output: { treks: [{ slug: "sandakphu" }, { slug: "dayara-bugyal" }] } },
      { type: "tool-input-available", toolCallId: "r1", toolName: "recommendTreks", input: {} },
      {
        type: "tool-output-available",
        toolCallId: "r1",
        output: { cards: [at("sandakphu", [27.1, 88.0]), at("dayara-bugyal", [30.86, 78.62])], reasons: {} },
      },
    ] as unknown as UIMessageChunk[];
    const source = new ReadableStream<UIMessageChunk>({
      start(c) {
        chunks.forEach((x) => c.enqueue(x));
        c.close();
      },
    });
    const out: UIMessageChunk[] = [];
    for await (const c of factCheckedStream(source, { treks: [], userNumbers: [] }, { instructions: "", origin: cityIn("4 days in December, from Delhi") })) out.push(c);
    const rec = out.at(-1) as { output: { cards: { slug: string }[] } };
    expect(rec.output.cards.map((c) => c.slug)).toEqual(["dayara-bugyal", "sandakphu"]);
  });
});
