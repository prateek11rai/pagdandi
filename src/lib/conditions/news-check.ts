import { BudgetExceededError, periodsIST, type BudgetStore, type Caps } from "../budget";
import type { Trek } from "../trek-schema";
import type { NewsSource } from "./news";
import type { NewsItem, NewsPayload, NewsSummary } from "./types";

export const NEWS_CHECK_USAGE = "Usage: pnpm news:check --trek <slug>";

// `--trek <slug>` and nothing else, so a typo can never become a search for something else.
export function parseNewsCheckArgs(argv: string[]): { slug: string } | { error: string } {
  const args = argv.filter((a) => a !== "--");
  if (args.length !== 2 || args[0] !== "--trek") return { error: NEWS_CHECK_USAGE };
  const slug = args[1]!;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return { error: `"${slug}" isn't a trek slug. ${NEWS_CHECK_USAGE}` };
  return { slug };
}

export interface Usage {
  day: number;
  month: number;
}

export async function serpApiUsage(store: BudgetStore, now: Date): Promise<Usage> {
  const { day, month } = periodsIST(now);
  return { day: await store.used("serpapi", "day", day), month: await store.used("serpapi", "month", month) };
}

export type NewsCheck =
  | { ok: false; reason: string; usage: Usage | null }
  | { ok: true; trek: Trek; news: NewsPayload; summary: NewsSummary | null; summaryError: string | null; usage: Usage };

export interface NewsCheckDeps {
  getTrek(slug: string): Promise<Trek | null>;
  news: NewsSource; // reserves budget before it searches, as in the digest
  budget: BudgetStore;
  caps: Caps;
  summarise(t: Trek, items: NewsItem[]): Promise<NewsSummary>;
  now?: Date;
}

// Exactly one live search for one trek. Refuses before searching when either cap is already reached, and never
// retries: a failed search is reported, not repeated. Saves nothing but the budget counters.
export async function newsCheck(slug: string, deps: NewsCheckDeps): Promise<NewsCheck> {
  const trek = await deps.getTrek(slug);
  if (!trek) return { ok: false, reason: `No trek called "${slug}" in the database; nothing was searched.`, usage: null };
  const now = deps.now ?? new Date();
  const before = await serpApiUsage(deps.budget, now);
  if (before.day >= deps.caps.daily) {
    return { ok: false, reason: `Today's SerpApi cap is reached (${before.day} of ${deps.caps.daily}); nothing was searched.`, usage: before };
  }
  if (before.month >= deps.caps.monthly) {
    return { ok: false, reason: `This month's SerpApi cap is reached (${before.month} of ${deps.caps.monthly}); nothing was searched.`, usage: before };
  }

  let news: NewsPayload;
  try {
    news = await deps.news.fetch(trek);
  } catch (e) {
    const reason = e instanceof BudgetExceededError ? `${e.message}; nothing was searched.` : `The search failed (${(e as Error).message}); not retrying.`;
    return { ok: false, reason, usage: await serpApiUsage(deps.budget, now) };
  }
  let summary: NewsSummary | null = null;
  let summaryError: string | null = null;
  try {
    summary = await deps.summarise(trek, news.items);
  } catch (e) {
    summaryError = (e as Error).message;
  }
  return { ok: true, trek, news, summary, summaryError, usage: await serpApiUsage(deps.budget, now) };
}
