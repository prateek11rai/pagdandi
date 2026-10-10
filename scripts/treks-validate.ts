// Validate every data/treks/*.yaml against the schema. Exits 1 on any error.
import { readTrekFiles } from "../src/lib/trek-files";

const results = readTrekFiles();
let failed = 0;
for (const r of results) {
  if (r.errors.length === 0) continue;
  failed++;
  console.error(`✗ ${r.file}`);
  for (const e of r.errors) console.error(`    ${e}`);
}
console.log(`${results.length - failed}/${results.length} trek files valid`);
process.exit(failed > 0 ? 1 : 0);
