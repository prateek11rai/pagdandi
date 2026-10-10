import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { searchTreks } from "@/lib/search";
import { closeDb, prepareDatabase } from "./stack";

beforeAll(prepareDatabase);
afterAll(closeDb);

const top = async (q: string, f = {}) => (await searchTreks(q, f, 5)).cards.map((c) => c.slug);

describe("hybrid search on real Postgres + EmbeddingGemma", () => {
  it("finds lakes in Kashmir", async () => expect((await top("high altitude lakes in Kashmir"))[0]).toBe("kashmir-great-lakes"));
  it("finds the root bridges", async () => expect((await top("living root bridges in the rain"))[0]).toBe("nongriat-root-bridges"));
  it("finds a weekend trek near Delhi", async () =>
    expect((await top("short trek near Delhi for a long weekend")).slice(0, 2)).toContain("nag-tibba"));
  it("applies filters to both sides", async () => {
    const cards = (await searchTreks("forest walk with views", { region: "sahyadri" }, 10)).cards;
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => c.region === "sahyadri")).toBe(true);
  });
  it("uses both full text and vectors", async () => {
    const r = await searchTreks("snow trek for beginners in December");
    expect(r.matched.vector).toBeGreaterThan(0);
    expect(r.matched.fullText).toBeGreaterThan(0);
  });
});
