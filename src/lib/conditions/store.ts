import "server-only";
import { sql } from "../db";
import type { ForecastPayload, LatestConditions, NewsPayload, NewsSummary } from "./types";

export async function getLatestConditions(slug: string): Promise<LatestConditions> {
  const db = sql();
  const rows = await db<{ kind: "forecast" | "news"; fetched_at: Date; payload: unknown; summary: unknown }[]>`
    select distinct on (kind) kind, fetched_at, payload, summary
    from conditions where slug = ${slug}
    order by kind, fetched_at desc
  `;
  const f = rows.find((r) => r.kind === "forecast");
  const n = rows.find((r) => r.kind === "news");
  return {
    forecast: f ? { fetchedAt: f.fetched_at, payload: f.payload as ForecastPayload } : null,
    news: n ? { fetchedAt: n.fetched_at, payload: n.payload as NewsPayload, summary: n.summary as NewsSummary | null } : null,
  };
}

export async function saveConditions(
  slug: string,
  kind: "forecast" | "news",
  payload: ForecastPayload | NewsPayload,
  summary: NewsSummary | null = null,
): Promise<void> {
  const db = sql();
  await db`insert into conditions (slug, kind, payload, summary) values (${slug}, ${kind}, ${db.json(payload as never)}, ${summary ? db.json(summary as never) : null})`;
}
