import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/chat/route";
import { closeDb, prepareDatabase } from "./stack";

beforeAll(prepareDatabase);
afterAll(closeDb);

interface Chunk {
  type: string;
  toolName?: string;
  toolCallId?: string;
  output?: { cards?: { slug: string; highestAltitudeM: number | null }[] };
  delta?: string;
}

async function ask(text: string): Promise<Chunk[]> {
  const res = await POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.7" },
      body: JSON.stringify({ messages: [{ id: "m1", role: "user", parts: [{ type: "text", text }] }] }),
    }),
  );
  expect(res.status).toBe(200);
  const body = await res.text();
  return body
    .split("\n")
    .filter((l) => l.startsWith("data: {"))
    .map((l) => JSON.parse(l.slice(6)) as Chunk);
}

describe("the trek guide on real Gemma", () => {
  it("recommends treks from the database for the group prompt", async () => {
    const chunks = await ask("5 of us, 2 first-timers, ₹12k each, 4 days in December, from Delhi");
    const calls = chunks.filter((c) => c.type === "tool-input-available").map((c) => c.toolName);
    expect(calls).toContain("searchTreks");
    expect(calls).toContain("recommendTreks");
    const recId = chunks.find((c) => c.type === "tool-input-available" && c.toolName === "recommendTreks")!.toolCallId;
    const out = chunks.find((c) => c.type === "tool-output-available" && c.toolCallId === recId)!.output!;
    expect(out.cards!.length).toBeGreaterThan(0);
    const text = chunks.filter((c) => c.type === "text-delta").map((c) => c.delta).join("");
    expect(text.length).toBeGreaterThan(20);
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
