import { BudgetExceededError } from "@/lib/budget";
import { isSevere, weatherLabel } from "@/lib/conditions/weather-codes";
import type { ForecastPayload, NewsItem, NewsPayload, NewsSummary, PlaceForecast } from "@/lib/conditions/types";
import { daysBetween, todayIST } from "@/lib/dates";
import { prepFor } from "@/lib/prep";
import { digestEmail, formatShortDate, type ForecastRow } from "@/lib/email-template";
import { expire, unsubscribeHeaders, unsubscribeUrlFor, type Mailer, type Subscription, type SubscriptionStore } from "@/lib/subscriptions";
import type { Trek } from "@/lib/trek-schema";

export interface DigestDeps {
  now: Date;
  siteUrl: string;
  store: SubscriptionStore;
  mailer: Mailer;
  getTrek(slug: string): Promise<Trek | null>;
  allSlugs(): Promise<string[]>;
  fetchForecast(t: Trek): Promise<ForecastPayload>;
  fetchNews(t: Trek): Promise<NewsPayload>; // may throw BudgetExceededError
  previousNewsUrls(slug: string): Promise<Set<string>>;
  summarise(t: Trek, items: NewsItem[]): Promise<NewsSummary>;
  saveConditions(slug: string, kind: "forecast" | "news", payload: ForecastPayload | NewsPayload, summary?: NewsSummary | null): Promise<void>;
}

export interface DigestReport {
  expired: number;
  treksChecked: number;
  emailsSent: number;
  // Their emails still go out, saying "forecast unavailable"; this alone doesn't fail the run.
  forecastFailures: { slug: string; reason: string }[];
  errors: string[]; // never contain emails, tokens or URLs with keys
  budgetExceeded: boolean;
}

export function exitCode(r: DigestReport): 0 | 1 {
  return r.budgetExceeded || r.errors.length > 0 ? 1 : 0;
}

// "fetch failed" alone says little; Node puts the network error code on `cause`.
function reasonOf(e: unknown): string {
  const err = e as Error & { cause?: { code?: unknown } };
  return typeof err.cause?.code === "string" ? `${err.message} (${err.cause.code})` : err.message;
}

interface TrekConditions {
  forecast: ForecastPayload | null;
  news: NewsSummary | null; // null when news couldn't be checked today
  newsNote: string | null;
  newsIsSample: boolean; // recorded fixtures in development: must never read as real news
}

// Conditions are fetched once per trek, however many people follow it. With `sweep`, every trek is refreshed.
export async function runDigest(deps: DigestDeps, opts: { sweep: boolean }): Promise<DigestReport> {
  const today = todayIST(deps.now);
  const report: DigestReport = { expired: 0, treksChecked: 0, emailsSent: 0, forecastFailures: [], errors: [], budgetExceeded: false };
  report.expired = await expire(deps.store, deps.now);

  const due = (await deps.store.listActive()).filter((s) => s.lastSentOn !== today);
  const bySlug = new Map<string, Subscription[]>();
  for (const s of due) bySlug.set(s.slug, [...(bySlug.get(s.slug) ?? []), s]);
  const slugs = opts.sweep ? await deps.allSlugs() : [...bySlug.keys()];

  for (const slug of slugs) {
    const trek = await deps.getTrek(slug);
    if (!trek) continue;
    const c = await checkTrek(trek, deps, report);
    report.treksChecked++;
    for (const sub of bySlug.get(slug) ?? []) {
      try {
        const unsubscribeUrl = await unsubscribeUrlFor(sub, deps.store, deps.siteUrl);
        const email = composeDigest(trek, sub, c, { today, siteUrl: deps.siteUrl, unsubscribeUrl });
        await deps.mailer.send({ to: sub.email, ...email, headers: unsubscribeHeaders(unsubscribeUrl) });
        await deps.store.markSent(sub.id, today);
        report.emailsSent++;
      } catch (e) {
        report.errors.push(`email for ${slug} failed: ${(e as Error).message}`);
      }
    }
  }
  return report;
}

async function checkTrek(trek: Trek, deps: DigestDeps, report: DigestReport): Promise<TrekConditions> {
  const out: TrekConditions = { forecast: null, news: null, newsNote: null, newsIsSample: false };
  try {
    out.forecast = await deps.fetchForecast(trek);
  } catch (e) {
    report.forecastFailures.push({ slug: trek.slug, reason: reasonOf(e) });
  }
  // Sample forecasts stay out of the database, so a trek page can never show one as real.
  if (out.forecast && !out.forecast.fixture) {
    try {
      await deps.saveConditions(trek.slug, "forecast", out.forecast);
    } catch (e) {
      report.errors.push(`saving the forecast for ${trek.slug} failed: ${(e as Error).message}`);
    }
  }
  try {
    const seen = await deps.previousNewsUrls(trek.slug);
    const news = await deps.fetchNews(trek);
    const fresh = news.items.filter((i) => !seen.has(i.url));
    out.newsIsSample = news.fixture === true;
    out.news = await deps.summarise(trek, fresh);
    await deps.saveConditions(trek.slug, "news", news, out.news);
  } catch (e) {
    if (e instanceof BudgetExceededError) {
      report.budgetExceeded = true;
      out.newsNote = "News check skipped today: our search budget is used up.";
    } else {
      out.newsNote = "News check failed today.";
    }
    report.errors.push(`news for ${trek.slug}: ${(e as Error).message}`);
  }
  return out;
}

export function statusLine(c: TrekConditions): string {
  const soon = c.forecast?.places.flatMap((p) => p.days.slice(0, 2)) ?? [];
  const severe = soon.find((d) => isSevere(d.code));
  if (severe) return `${weatherLabel(severe.code)} in the forecast`;
  if (c.news && c.news.bullets.length > 0) return "news to read";
  if (!c.forecast) return "forecast unavailable";
  return "all clear so far";
}

const DAY = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

const round1 = (n: number) => Math.round(n * 10) / 10;

function forecastRow(p: PlaceForecast): ForecastRow {
  return {
    label: p.place === "road_head" ? "Road head" : "High point (estimate)",
    place: `${p.name}${p.elevationM !== null ? `, ${p.elevationM.toLocaleString("en-IN")} m` : ""}`,
    days: p.days.slice(0, 2).map((d) => {
      const temp = d.tminC !== null && d.tmaxC !== null ? `${Math.round(d.tminC)} to ${Math.round(d.tmaxC)} °C` : "temperature n/a";
      const wet = d.snowCm ? `, ${round1(d.snowCm)} cm snow` : d.precipMm ? `, ${round1(d.precipMm)} mm rain` : "";
      return `${DAY.format(new Date(d.date))}: ${weatherLabel(d.code)}, ${temp}${wet}`;
    }),
  };
}

export function composeDigest(
  trek: Trek,
  sub: Subscription,
  c: TrekConditions,
  o: { today: string; siteUrl: string; unsubscribeUrl: string },
): { subject: string; text: string; html: string } {
  const n = daysBetween(o.today, sub.travelDate);
  return digestEmail({
    siteUrl: o.siteUrl,
    trek: { name: trek.name, state: trek.state, slug: trek.slug },
    togo: n <= 0 ? "you leave today" : n === 1 ? "1 day to go" : `${n} days to go`,
    travelDate: sub.travelDate,
    status: statusLine(c),
    forecast: c.forecast ? c.forecast.places.map(forecastRow) : null,
    forecastSample: c.forecast?.fixture === true,
    news: (c.news?.bullets ?? []).map((b) => ({ text: b.text, source: b.source ?? null, date: b.date ? formatShortDate(b.date) : null, url: b.url })),
    newsNote: c.newsNote,
    newsSample: c.newsIsSample,
    prep: prepFor(n),
    unsubscribeUrl: o.unsubscribeUrl,
  });
}
