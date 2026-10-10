// Apply db/migrations/*.sql in order, once each, each in its own transaction.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { loadEnv } from "../src/lib/env";
import { closeDb, sql } from "../src/lib/db";

loadEnv("db");
const db = sql();
const dir = path.join(process.cwd(), "db", "migrations");

await db`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
const applied = new Set((await db<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name));

for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (applied.has(file)) continue;
  const body = readFileSync(path.join(dir, file), "utf8");
  await db.begin(async (tx) => {
    await tx.unsafe(body);
    await tx`insert into schema_migrations (name) values (${file})`;
  });
  console.log(`applied ${file}`);
}
await closeDb();
