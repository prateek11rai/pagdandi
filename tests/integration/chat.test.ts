import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/chat/route";
import { ask, expectSafe } from "./guide";
import { closeDb, prepareDatabase } from "./stack";

beforeAll(prepareDatabase);
afterAll(closeDb);

// Gemma on CI's CPU runner takes 80-180+ s for this turn (docs/BUILD_LOG.md); a slow run is not a bug.
describe("the trek guide on real Gemma", { timeout: 420_000 }, () => {
  it("recommends treks from the database for the group prompt, nearest first", async () => {
    const turn = await ask("5 of us, 2 first-timers, ₹12k each, 4 days in December, from Delhi");
    await expectSafe(turn);
    expect(turn.toolCalls).toContain("searchTreks");
    expect(turn.toolCalls).toContain("recommendTreks");
    expect(turn.cards.length).toBeGreaterThan(0);
    // Cards follow the search's distance-aware ranking, not the model's order. In December only Dayara Bugyal
    // fits this group in Uttarakhand or Himachal (docs/BUILD_LOG.md), so only the first card is pinned.
    expect(["uttarakhand", "himachal"]).toContain(turn.cards[0]!.region);
    expect(turn.prose.length).toBeGreaterThan(20);
  });

  it("refuses a question that is too long", async () => {
    const res = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.8" },
        body: JSON.stringify({ messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "x".repeat(600) }] }] }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
