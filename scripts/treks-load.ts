// Load validated trek YAML into Postgres: treks + trek_docs (text only; `pnpm treks:embed` adds vectors).
// `--only a,b` loads just those treks and removes nothing (handy when adding one trek).
import { closeDb } from "../src/lib/db";
import { loadEnv } from "../src/lib/env";
import { readTrekFiles } from "../src/lib/trek-files";
import { loadTreks } from "../src/lib/trek-load";

loadEnv("db");
const onlyArg = process.argv.find((a, i) => process.argv[i - 1] === "--only");
const only = onlyArg ? new Set(onlyArg.split(",")) : null;
const results = readTrekFiles().filter((r) => !only || only.has(r.file.replace(/\.yaml$/, "")));
if (only && results.length !== only.size) {
  console.error("Some --only treks have no file in data/treks.");
  process.exit(1);
}
const bad = results.filter((r) => r.errors.length > 0);
if (bad.length > 0) {
  console.error(`Refusing to load: ${bad.length} invalid trek file(s). Run pnpm treks:validate.`);
  process.exit(1);
}
const { loaded, removed } = await loadTreks(results.map((r) => r.trek!), { prune: !only });
if (removed > 0) console.log(`removed ${removed} trek(s) no longer in data/treks`);
console.log(`loaded ${loaded} treks`);
await closeDb();
