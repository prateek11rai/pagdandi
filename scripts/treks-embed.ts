// Embed trek documents that have no vector yet (or all of them with --all), using EmbeddingGemma via Ollama.
import { env, loadEnv } from "../src/lib/env";
import { closeDb, sql } from "../src/lib/db";
import { embedDocuments } from "../src/lib/ollama";

loadEnv("db");
const all = process.argv.includes("--all");
const db = sql();
const model = env().EMBED_MODEL;
const docs = await db<{ slug: string; title: string; body: string }[]>`
  select slug, title, body from trek_docs
  ${all ? db`` : db`where embedding is null or embed_model is distinct from ${model}`}
  order by slug
`;
const started = performance.now();
for (let i = 0; i < docs.length; i += 8) {
  const batch = docs.slice(i, i + 8);
  const vectors = await embedDocuments(batch);
  for (const [j, d] of batch.entries()) {
    await db`update trek_docs set embedding = ${`[${vectors[j]!.join(",")}]`}::vector, embed_model = ${model}, embedded_at = now() where slug = ${d.slug}`;
  }
}
const secs = ((performance.now() - started) / 1000).toFixed(1);
console.log(`embedded ${docs.length} trek document(s) with ${model} in ${secs}s`);
await closeDb();
