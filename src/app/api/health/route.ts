import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Render's health check. The web app is healthy if it can reach Postgres; the model service is reported, not required.
export async function GET() {
  let db = false;
  try {
    await sql()`select 1`;
    db = true;
  } catch {}
  return Response.json({ ok: db, db }, { status: db ? 200 : 503, headers: { "cache-control": "no-store" } });
}
