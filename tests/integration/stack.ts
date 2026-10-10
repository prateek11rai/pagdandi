import path from "node:path";
import postgres from "postgres";
import { closeDb } from "@/lib/db";
import { readTrekFiles } from "@/lib/trek-files";
import { embedTreks, loadTreks, migrate, migrationFiles } from "@/lib/trek-load";

const DOWN = "The local stack isn't running: run `pnpm dev:up` first (Postgres on 127.0.0.1:54329 and Ollama).";

// Fails loudly when Postgres or Ollama is down. Integration tests never skip.
export async function requireStack(): Promise<void> {
  const probe = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 3, onnotice: () => {} });
  try {
    await probe`select 1`;
  } catch {
    throw new Error(DOWN);
  } finally {
    await probe.end({ timeout: 1 });
  }
  const ok = await fetch(`${process.env.OLLAMA_BASE_URL}/api/version`, { signal: AbortSignal.timeout(3_000) })
    .then((r) => r.ok)
    .catch(() => false);
  if (!ok) throw new Error(DOWN);
}

// Fresh, fully loaded and embedded test database.
export async function prepareDatabase(): Promise<void> {
  await requireStack();
  await migrate(await migrationFiles(path.join(process.cwd(), "db", "migrations")));
  const treks = readTrekFiles().map((r) => {
    if (!r.trek) throw new Error(`${r.file} is invalid: ${r.errors.join("; ")}`);
    return r.trek;
  });
  await loadTreks(treks, { prune: true });
  await embedTreks({ all: false });
}

export { closeDb };
