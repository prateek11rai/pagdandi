import { describe, expect, it } from "vitest";
import { instructionsFor } from "@/mastra/agents/trek-guide";
import { floorAtModerate } from "@/mastra/tools/search-treks";

describe("trek guide instructions", () => {
  it("carry today's date in India, so relative dates become a month", () => {
    const text = instructionsFor(new Date("2026-10-10T20:00:00Z")); // 01:30 IST on Sunday 11 October
    expect(text).toContain("Today is Sunday, 11 October 2026 in India.");
    expect(text).toContain("this weekend");
  });

  it("never filter below moderate, since our easy grade is stricter than a group's", () => {
    expect(["easy", "moderate", "difficult"].map((d) => floorAtModerate(d as "easy"))).toEqual(["moderate", "moderate", "difficult"]);
  });
});
