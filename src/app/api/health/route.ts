import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// A health check for `curl` or a monitor: healthy if the app can reach Postgres.
export async function GET() {
  let db = false;
  try {
    await sql()`select 1`;
    db = true;
  } catch {}
  return Response.json({ ok: db, db }, { status: db ? 200 : 503, headers: { "cache-control": "no-store" } });
}
