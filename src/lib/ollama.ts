import "server-only";
import { env } from "./env";

// EmbeddingGemma prompt prefixes for asymmetric retrieval (queries vs documents).
export const QUERY_PREFIX = "task: search result | query: ";
export const docPrefix = (title: string) => `title: ${title} | text: `;

async function embed(inputs: string[]): Promise<number[][]> {
  const { OLLAMA_BASE_URL, EMBED_MODEL } = env();
  const res = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Ollama embed failed with HTTP ${res.status}`);
  const body = (await res.json()) as { embeddings?: number[][] };
  if (!body.embeddings || body.embeddings.length !== inputs.length) throw new Error("Ollama embed returned no embeddings");
  return body.embeddings;
}

export async function embedQuery(query: string): Promise<number[]> {
  const [v] = await embed([QUERY_PREFIX + query]);
  return v!;
}

export async function embedDocuments(docs: { title: string; body: string }[]): Promise<number[][]> {
  return embed(docs.map((d) => docPrefix(d.title) + d.body));
}
