import "server-only";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { env } from "@/lib/env";

// Gemma served by our own Ollama, through its OpenAI-compatible endpoint. No model vendor sees the chat.
export function chatModel() {
  const { OLLAMA_BASE_URL, CHAT_MODEL } = env();
  const ollama = createOpenAICompatible({ name: "ollama", baseURL: `${OLLAMA_BASE_URL}/v1` });
  return ollama.chatModel(CHAT_MODEL);
}
