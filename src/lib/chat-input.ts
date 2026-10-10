import { z } from "zod";

export const MAX_USER_CHARS = 500;
const MAX_ASSISTANT_CHARS = 800;
const KEEP_MESSAGES = 8;

const incoming = z.object({
  messages: z
    .array(
      z.object({
        id: z.string().max(100),
        role: z.enum(["user", "assistant"]),
        parts: z.array(z.object({ type: z.string(), text: z.string().optional() }).loose()).max(50),
      }),
    )
    .min(1)
    .max(40),
});

export interface CleanMessage {
  id: string;
  role: "user" | "assistant";
  parts: { type: "text"; text: string }[];
}

export type ParsedChat = { ok: true; messages: CleanMessage[]; userText: string } | { ok: false; message: string };

// Keep only text, only recent turns, within length caps. Everything else the browser sends is ignored.
export function parseChatBody(body: unknown): ParsedChat {
  const parsed = incoming.safeParse(body);
  if (!parsed.success) return { ok: false, message: "That message couldn't be read." };
  const messages = parsed.data.messages
    .map((m) => ({
      id: m.id,
      role: m.role,
      text: m.parts
        .filter((p) => p.type === "text" && typeof p.text === "string")
        .map((p) => p.text!)
        .join("\n")
        .trim(),
    }))
    .filter((m) => m.text.length > 0)
    .slice(-KEEP_MESSAGES);
  const last = messages.at(-1);
  if (!last || last.role !== "user") return { ok: false, message: "Ask a question to start." };
  if (last.text.length > MAX_USER_CHARS) {
    return { ok: false, message: `Please keep questions under ${MAX_USER_CHARS} characters.` };
  }
  return {
    ok: true,
    userText: messages.filter((m) => m.role === "user").map((m) => m.text).join("\n"),
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      parts: [{ type: "text", text: m.text.slice(0, m.role === "user" ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS) }],
    })),
  };
}
