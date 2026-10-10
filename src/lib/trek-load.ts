import "server-only";
import { sql } from "./db";
import { env } from "./env";
import { embedDocuments } from "./ollama";
import { trekDocument } from "./trek-doc";
import type { Trek } from "./trek-schema";

// Upsert treks and their search documents. A changed document drops its vector so embedding refreshes it.
// With `prune`, treks no longer in the list are deleted.
export async function loadTreks(treks: Trek[], { prune }: { prune: boolean }): Promise<{ loaded: number; removed: number }> {
  let removed = 0;
  await sql().begin(async (tx) => {
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
      await tx`
        insert into trek_docs (slug, title, body) values (${t.slug}, ${doc.title}, ${doc.body})
        on conflict (slug) do update set
          title = excluded.title, body = excluded.body,
          embedding = case when trek_docs.title = excluded.title and trek_docs.body = excluded.body then trek_docs.embedding end,
          embedded_at = case when trek_docs.title = excluded.title and trek_docs.body = excluded.body then trek_docs.embedded_at end
      `;
    }
    if (prune) {
      const rows = await tx`delete from treks where slug <> all(${treks.map((t) => t.slug)}) returning slug`;
      removed = rows.length;
    }
  });
  return { loaded: treks.length, removed };
}

// Embed documents without a vector for the current model (or all of them).
export async function embedTreks({ all }: { all: boolean }): Promise<number> {
  const db = sql();
  const model = env().EMBED_MODEL;
  const docs = await db<{ slug: string; title: string; body: string }[]>`
    select slug, title, body from trek_docs
    ${all ? db`` : db`where embedding is null or embed_model is distinct from ${model}`}
    order by slug
  `;
  for (let i = 0; i < docs.length; i += 8) {
    const batch = docs.slice(i, i + 8);
    const vectors = await embedDocuments(batch);
    for (const [j, d] of batch.entries()) {
      await db`update trek_docs set embedding = ${`[${vectors[j]!.join(",")}]`}::vector, embed_model = ${model}, embedded_at = now() where slug = ${d.slug}`;
    }
  }
  return docs.length;
}

// Apply db/migrations/*.sql in order, once each.
export async function migrate(files: { name: string; body: string }[]): Promise<string[]> {
  const db = sql();
  await db`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const applied = new Set((await db<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name));
  const done: string[] = [];
  for (const f of files) {
    if (applied.has(f.name)) continue;
    await db.begin(async (tx) => {
      await tx.unsafe(f.body);
      await tx`insert into schema_migrations (name) values (${f.name})`;
    });
    done.push(f.name);
  }
  return done;
}

export async function migrationFiles(dir: string): Promise<{ name: string; body: string }[]> {
  const { readdirSync, readFileSync } = await import("node:fs");
  const path = await import("node:path");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, body: readFileSync(path.join(dir, name), "utf8") }));
}
