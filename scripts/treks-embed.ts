// Embed trek documents that have no vector yet (or all of them with --all), using EmbeddingGemma via Ollama.
// --if-available exits cleanly when Ollama or the model isn't ready yet (first deploy): search then uses
// full text only until the next run.
import { closeDb } from "../src/lib/db";
import { env, loadEnv } from "../src/lib/env";
import { embedTreks } from "../src/lib/trek-load";

loadEnv("db");
const model = env().EMBED_MODEL;
if (process.argv.includes("--if-available")) {
  const ready = await fetch(`${env().OLLAMA_BASE_URL}/api/show`, {
    method: "POST",
    body: JSON.stringify({ model }),
    signal: AbortSignal.timeout(5_000),
  })
    .then((r) => r.ok)
    .catch(() => false);
  if (!ready) {
    console.log(`${model} isn't available on Ollama yet; skipped embedding. Search uses full text until the next run.`);
    await closeDb();
    process.exit(0);
  }
}
const started = performance.now();
const n = await embedTreks({ all: process.argv.includes("--all") });
console.log(`embedded ${n} trek document(s) with ${model} in ${((performance.now() - started) / 1000).toFixed(1)}s`);
await closeDb();
