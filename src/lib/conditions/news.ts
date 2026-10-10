import { readFileSync } from "node:fs";
import path from "node:path";
import { reserve, type BudgetStore, type Caps } from "../budget";
import type { Trek } from "../trek-schema";
import type { NewsItem, NewsPayload } from "./types";

export interface NewsSource {
  fetch(t: Trek): Promise<NewsPayload>;
}

export function newsQuery(t: Trek): string {
  return `"${t.name}" ${t.state} (trek OR landslide OR snowfall OR closed OR permit) when:7d`;
}

// Live Google News results through SerpApi. Every call reserves budget first; a full budget throws.
export function serpApiNews(opts: { apiKey: string; budget: BudgetStore; caps: Caps }): NewsSource {
  return {
    async fetch(t) {
      await reserve(opts.budget, "serpapi", opts.caps);
      const q = newsQuery(t);
      const url = new URL("https://serpapi.com/search.json");
      url.searchParams.set("engine", "google_news");
      url.searchParams.set("q", q);
      url.searchParams.set("gl", "in");
      url.searchParams.set("hl", "en");
      url.searchParams.set("api_key", opts.apiKey);
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      // Never include the URL in errors: it carries the API key.
      if (!res.ok) throw new Error(`SerpApi returned HTTP ${res.status}`);
      const body = (await res.json()) as { news_results?: RawItem[] };
      return { query: q, items: normalise(body.news_results ?? []) };
    },
  };
}

interface RawItem {
  title?: string;
  link?: string;
  iso_date?: string;
  source?: { name?: string };
  stories?: RawItem[];
}

export function normalise(raw: RawItem[]): NewsItem[] {
  const flat = raw.flatMap((r) => (r.stories?.length ? r.stories : [r]));
  return flat
    .filter((r): r is RawItem & { title: string; link: string } => !!r.title && !!r.link && r.link.startsWith("https://"))
    .map((r) => ({ title: r.title, url: r.link, source: r.source?.name ?? null, date: r.iso_date ?? null }))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, 8);
}

// Recorded sample responses for development, clearly marked as fixtures. Most treks have none ("no news").
export function fixtureNews(): NewsSource {
  return {
    async fetch(t) {
      const file = path.join(process.cwd(), "src", "lib", "conditions", "fixtures", "serpapi-sample.json");
      const samples = JSON.parse(readFileSync(file, "utf8")) as Record<string, RawItem[]>;
      return { query: newsQuery(t), items: normalise(samples[t.slug] ?? []), fixture: true };
    },
  };
}
