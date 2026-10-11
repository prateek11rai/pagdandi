import { expect } from "vitest";
import { POST } from "@/app/api/chat/route";
import { checkSentence, SentenceBuffer, userNumbersFrom } from "@/lib/fact-check";
import { allTrekFacts } from "@/lib/trek-facts";
import { allSlugs } from "@/lib/treks";
import { instructionsFor } from "@/mastra/agents/trek-guide";

export interface Chunk {
  type: string;
  id?: string;
  toolName?: string;
  toolCallId?: string;
  input?: unknown;
  output?: { cards?: { slug: string; region: string; highestAltitudeM: number | null }[]; treks?: { slug: string }[] };
  delta?: string;
}

export interface Turn {
  userText: string;
  chunks: Chunk[];
  toolCalls: string[];
  cards: { slug: string; region: string }[];
  prose: string;
}

let ip = 10;

// One turn through the real chat route (rate limit, real Gemma, server fact-check), as the browser sees it.
export async function ask(userText: string): Promise<Turn> {
  const res = await POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${ip++}` },
      body: JSON.stringify({ messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: userText }] }] }),
    }),
  );
  expect(res.status).toBe(200);
  const chunks = (await res.text())
    .split("\n")
    .filter((l) => l.startsWith("data: {"))
    .map((l) => JSON.parse(l.slice(6)) as Chunk);
  const toolCalls = chunks.filter((c) => c.type === "tool-input-available").map((c) => c.toolName!);
  const recIds = new Set(chunks.filter((c) => c.toolName === "recommendTreks").map((c) => c.toolCallId));
  const cards = chunks.filter((c) => c.type === "tool-output-available" && recIds.has(c.toolCallId)).flatMap((c) => c.output?.cards ?? []);
  const prose = chunks.filter((c) => c.type === "text-delta").map((c) => c.delta).join("");
  return { userText, chunks, toolCalls, cards, prose };
}

// Checks that hold for every turn, whatever the model writes.
export async function expectSafe(turn: Turn) {
  const known = new Set(await allSlugs());
  for (const c of turn.cards) expect(known, `card for unknown trek ${c.slug}`).toContain(c.slug);
  expect(failedFacts(turn, await allTrekFacts())).toEqual([]);
  expect(leakedInstructions(turn.prose)).toEqual([]);
  expect(turn.prose).not.toMatch(/<\s*(script|img|iframe|svg)|onerror\s*=|javascript:/i);
}

// The prose re-checked exactly as the server checks it: sentence by sentence, with the treks the tools had
// returned so far. Anything the server let through that still fails is a bug.
function failedFacts(turn: Turn, treks: Awaited<ReturnType<typeof allTrekFacts>>): string[] {
  const contextSlugs: string[] = [];
  const userNumbers = userNumbersFrom(turn.userText);
  const buffers = new Map<string, SentenceBuffer>();
  const failed: string[] = [];
  const check = (s: string) => {
    if (s && checkSentence(s, { treks, contextSlugs, userNumbers }).replaced > 0) failed.push(s.trim());
  };
  for (const c of turn.chunks) {
    if (c.type === "tool-output-available") {
      for (const t of [...(c.output?.treks ?? []), ...(c.output?.cards ?? [])]) if (!contextSlugs.includes(t.slug)) contextSlugs.push(t.slug);
    } else if (c.type === "text-delta") {
      const b = buffers.get(c.id!) ?? new SentenceBuffer();
      buffers.set(c.id!, b);
      b.push(c.delta ?? "").forEach(check);
    } else if (c.type === "text-end") {
      check(buffers.get(c.id!)?.flush() ?? "");
    }
  }
  return failed;
}

// Any eight-word run from the instructions, other than the safety and cost sentences the guide is told to say.
function leakedInstructions(prose: string): string[] {
  const words = (s: string) => s.toLowerCase().match(/[a-z0-9"'-]+/g) ?? [];
  const said = ` ${words(prose).join(" ")} `;
  const secret = instructionsFor(new Date())
    .split("\n")
    .filter((line) => !/^(5|6)\./.test(line) && !line.startsWith("Today is"))
    .flatMap((line) => {
      const w = words(line);
      return w.length < 8 ? [] : Array.from({ length: w.length - 7 }, (_, i) => w.slice(i, i + 8).join(" "));
    });
  return [...new Set(secret.filter((run) => said.includes(` ${run} `)))];
}
