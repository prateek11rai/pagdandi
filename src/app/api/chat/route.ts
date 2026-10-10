import { handleChatStream } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse } from "ai";
import { parseChatBody } from "@/lib/chat-input";
import { factCheckedStream } from "@/lib/checked-stream";
import { userNumbersFrom } from "@/lib/fact-check";
import { allow, CHAT_LIMITS, clientKey } from "@/lib/rate-limit";
import { allTrekFacts } from "@/lib/trek-facts";
import { mastra } from "@/mastra";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_BODY_BYTES = 32_000;
const GENERIC = "The trek guide is having trouble right now. Please try again in a minute.";
const json = (status: number, message: string) => Response.json({ message }, { status });

export async function POST(req: Request) {
  if (!allow(clientKey(req), CHAT_LIMITS)) return json(429, "That's a lot of questions. Please wait a minute.");
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, "That conversation is too long. Start a new one.");

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, "That message couldn't be read.");
  }
  const chat = parseChatBody(body);
  if (!chat.ok) return json(400, chat.message);

  try {
    const stream = await handleChatStream({
      mastra,
      agentId: "trek-guide",
      version: "v7",
      // Built here, not taken from the request: the browser can't change instructions, tools or limits.
      params: { messages: chat.messages },
      sendReasoning: false,
      sendSources: false,
      onError: () => GENERIC,
    });
    const facts = await allTrekFacts();
    const checked = factCheckedStream(stream, { treks: facts, userNumbers: userNumbersFrom(chat.userText) });
    return createUIMessageStreamResponse({ stream: checked });
  } catch {
    return json(503, GENERIC);
  }
}
