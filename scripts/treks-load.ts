// Load validated trek YAML into Postgres: treks + trek_docs (text only; `pnpm treks:embed` adds vectors).
// `--only a,b` loads just those treks and removes nothing (handy when adding one trek).
import { loadEnv } from "../src/lib/env";
import { closeDb, sql } from "../src/lib/db";
import { readTrekFiles } from "../src/lib/trek-files";
import { trekDocument } from "../src/lib/trek-doc";

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
const treks = results.map((r) => r.trek!);
const db = sql();

await db.begin(async (tx) => {
  for (const t of treks) {
    await tx`
      insert into treks ${tx({
        slug: t.slug,
        name: t.name,
        state: t.state,
        region: t.region,
        difficulty: t.difficulty,
        days: t.days,
        highest_altitude_m: t.highest_point.altitude_m,
        season_months: t.season_months,
        budget_min_inr: t.budget_inr.min,
        budget_max_inr: t.budget_inr.max,
        start_lat: t.start.lat,
        start_lon: t.start.lon,
        start_altitude_m: t.start.altitude_m,
        data: tx.json(t as never),
      })}
      on conflict (slug) do update set
        name = excluded.name, state = excluded.state, region = excluded.region, difficulty = excluded.difficulty,
        days = excluded.days, highest_altitude_m = excluded.highest_altitude_m, season_months = excluded.season_months,
        budget_min_inr = excluded.budget_min_inr, budget_max_inr = excluded.budget_max_inr,
        start_lat = excluded.start_lat, start_lon = excluded.start_lon, start_altitude_m = excluded.start_altitude_m,
        data = excluded.data, loaded_at = now()
    `;
    const doc = trekDocument(t);
    // A changed document drops its old vector so treks:embed refreshes it.
    await tx`
      insert into trek_docs (slug, title, body) values (${t.slug}, ${doc.title}, ${doc.body})
      on conflict (slug) do update set
        title = excluded.title, body = excluded.body,
        embedding = case when trek_docs.title = excluded.title and trek_docs.body = excluded.body then trek_docs.embedding end,
        embedded_at = case when trek_docs.title = excluded.title and trek_docs.body = excluded.body then trek_docs.embedded_at end
    `;
  }
  if (!only) {
    const removed = await tx`delete from treks where slug <> all(${treks.map((t) => t.slug)}) returning slug`;
    if (removed.length > 0) console.log(`removed ${removed.length} trek(s) no longer in data/treks`);
  }
});
console.log(`loaded ${treks.length} treks`);
await closeDb();
