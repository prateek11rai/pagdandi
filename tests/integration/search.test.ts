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

describe("the guide's search tool", () => {
  it("ranks a Delhi group's options by distance among treks that fit", async () => {
    const { searchTreksTool } = await import("@/mastra/tools/search-treks");
    const out = (await searchTreksTool.execute!(
      { query: "beginner friendly trek", from: "Delhi", month: 12, maxDays: 4, maxDifficulty: "moderate", maxBudgetInr: 12000 },
      {} as never,
    )) as { treks: { slug: string }[]; relaxed?: string };
    expect(out.relaxed).toBeUndefined();
    expect(out.treks[0]!.slug).toBe("dayara-bugyal");
    expect(out.treks.map((t) => t.slug).indexOf("kudremukh")).not.toBe(0);
  });

  it("applies the group's limits before ranking", async () => {
    const { searchTreksTool } = await import("@/mastra/tools/search-treks");
    const out = (await searchTreksTool.execute!(
      { query: "easy trek", from: "Bangalore", month: 1, maxDays: 2, maxDifficulty: "moderate" },
      {} as never,
    )) as { treks: { slug: string; days: number | null }[] };
    expect(out.treks.length).toBeGreaterThan(1);
    expect(out.treks[0]!.slug).toBe("kudremukh");
    expect(out.treks.every((t) => t.days === null || t.days <= 2)).toBe(true);
  });
});
