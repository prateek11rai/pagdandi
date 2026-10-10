import { BudgetExceededError } from "@/lib/budget";
import { isSevere, weatherLabel } from "@/lib/conditions/weather-codes";
import type { ForecastPayload, NewsItem, NewsPayload, NewsSummary, PlaceForecast } from "@/lib/conditions/types";
import { daysBetween, todayIST } from "@/lib/dates";
import { prepFor } from "@/lib/prep";
import { escapeHtml, expire, unsubscribeHeaders, unsubscribeUrlFor, type Mailer, type Subscription, type SubscriptionStore } from "@/lib/subscriptions";
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
  errors: string[]; // never contain emails, tokens or URLs with keys
  budgetExceeded: boolean;
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
  const report: DigestReport = { expired: 0, treksChecked: 0, emailsSent: 0, errors: [], budgetExceeded: false };
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
    await deps.saveConditions(trek.slug, "forecast", out.forecast);
  } catch (e) {
    report.errors.push(`forecast for ${trek.slug} failed: ${(e as Error).message}`);
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

function placeLines(p: PlaceForecast): string[] {
  const head = `${p.place === "road_head" ? "Road head" : "High point (estimate)"}: ${p.name}${p.elevationM !== null ? `, ${p.elevationM.toLocaleString("en-IN")} m` : ""}`;
  const days = p.days.slice(0, 2).map((d) => {
    const temp = d.tminC !== null && d.tmaxC !== null ? `${Math.round(d.tminC)} to ${Math.round(d.tmaxC)} °C` : "temperature n/a";
    const wet = d.snowCm ? `, ${round1(d.snowCm)} cm snow` : d.precipMm ? `, ${round1(d.precipMm)} mm rain` : "";
    return `  ${DAY.format(new Date(d.date))}: ${weatherLabel(d.code)}, ${temp}${wet}`;
  });
  return [head, ...days];
}

export function composeDigest(
  trek: Trek,
  sub: Subscription,
  c: TrekConditions,
  o: { today: string; siteUrl: string; unsubscribeUrl: string },
): { subject: string; text: string; html: string } {
  const n = daysBetween(o.today, sub.travelDate);
  const togo = n <= 0 ? "you leave today" : n === 1 ? "1 day to go" : `${n} days to go`;
  const subject = `${trek.name} · ${togo} · ${statusLine(c)}`;
  const forecast = c.forecast ? c.forecast.places.flatMap(placeLines) : ["Forecast unavailable today."];
  const news =
    c.newsNote !== null
      ? [c.newsNote]
      : c.news && c.news.bullets.length > 0
        ? c.news.bullets.map((b) => `- ${b.text} ${b.url}`)
        : ["Nothing new."];
  if (c.newsIsSample) news.unshift("[SAMPLE DATA for development: these are not real news reports]");
  const prep = prepFor(n);
  const page = `${o.siteUrl}/treks/${trek.slug}`;
  const text = [
    `${trek.name} · ${togo}`,
    "",
    "FORECAST",
    ...forecast,
    "",
    "NEWS SINCE YESTERDAY",
    ...news,
    "",
    "ONE THING TO DO OUTSIDE TODAY",
    prep,
    "",
    `Trek page: ${page}`,
    c.newsIsSample ? "Weather data by Open-Meteo.com. News: sample data." : "Weather data by Open-Meteo.com. News found through SerpApi.",
    `Stop these emails: ${o.unsubscribeUrl}`,
  ].join("\n");
  const html = `<div style="font-family:Georgia,serif;max-width:560px;color:#1f2a24">
<h2 style="margin:0 0 4px">${escapeHtml(trek.name)}</h2><p style="margin:0 0 16px;color:#5a635c">${escapeHtml(togo)}</p>
<h3>Forecast</h3><p>${forecast.map(escapeHtml).join("<br>")}</p>
<h3>News since yesterday</h3><p>${news.map((l) => escapeHtml(l)).join("<br>")}</p>
<h3>One thing to do outside today</h3><p>${escapeHtml(prep)}</p>
<p><a href="${page}">Trek page</a> · Weather data by <a href="https://open-meteo.com/">Open-Meteo.com</a> · <a href="${o.unsubscribeUrl}">Stop these emails</a></p></div>`;
  return { subject, text, html };
}
