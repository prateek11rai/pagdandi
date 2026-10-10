// Run a fixed set of searches and print the top results, for docs/BUILD_LOG.md.
import { loadEnv } from "../src/lib/env";
import { closeDb } from "../src/lib/db";
import { searchTreks } from "../src/lib/search";

loadEnv("db");
const QUERIES = [
  "snow trek for beginners in December",
  "easy one day hike near Mumbai",
  "high altitude lakes in Kashmir",
  "living root bridges in the rain",
  "short trek near Delhi for a long weekend",
];
for (const q of QUERIES) {
  const t = performance.now();
  const r = await searchTreks(q, {}, 5);
  const ms = Math.round(performance.now() - t);
  console.log(`| ${q} | ${r.cards.map((c) => c.slug).join(", ")} | ${r.matched.fullText}/${r.matched.vector} | ${ms} ms |`);
}
await closeDb();
