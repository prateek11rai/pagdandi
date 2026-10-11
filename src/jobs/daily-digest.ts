// Run by hand from the laptop whenever you want today's email; nothing schedules it. `pnpm digest --dry-run` prints the
// emails (recipient masked, tokens redacted) instead of sending them; `--sweep` refreshes every trek (a run on a Sunday
// does this), `--no-sweep` skips that; `--resend` sends today's email again to subscribers who already had it (admin use,
// for a demo; the news search still counts against the caps).
import { sqlBudgetStore } from "@/lib/budget-sql";
import { fixtureForecast, openMeteoForecast } from "@/lib/conditions/open-meteo";
import { fixtureNews, recordReplyErrors, serpApiNews } from "@/lib/conditions/news";
import { saveConditions } from "@/lib/conditions/store";
import { summariseNews } from "@/lib/conditions/summarize";
import { closeDb } from "@/lib/db";
import { mailer } from "@/lib/email";
import { loadEnv } from "@/lib/env";
import { sqlSubscriptionStore } from "@/lib/subscriptions-sql";
import type { Mailer } from "@/lib/subscriptions";
import { allSlugs, getTrek } from "@/lib/treks";
import { chatModel } from "@/mastra/model";
import { exitCode, runDigest } from "./digest-core";

const e = loadEnv("digest");
const dryRun = process.argv.includes("--dry-run");
const now = new Date();
// Sundays (IST) refresh every trek; --no-sweep turns that off for a one-off manual run.
const sunday = new Date(now.getTime() + 5.5 * 3600_000).getUTCDay() === 0;
const sweep = process.argv.includes("--sweep") || (sunday && !process.argv.includes("--no-sweep"));
const resend = process.argv.includes("--resend");

const printMailer: Mailer = {
  async send(m) {
    const at = m.to.indexOf("@");
    const masked = at > 1 ? `${m.to[0]}***${m.to.slice(at)}` : "***";
    const redact = (s: string) => s.replace(/token=[A-Za-z0-9_-]+/g, "token=REDACTED");
    console.log(`\n=== To: ${masked}\nSubject: ${m.subject}\n\n${redact(m.text)}\n`);
  },
};

const forecasts = e.FORECAST_MODE === "fixtures" ? fixtureForecast() : openMeteoForecast();
const news =
  e.NEWS_MODE === "serpapi"
    ? serpApiNews({
        apiKey: e.SERPAPI_API_KEY!,
        budget: sqlBudgetStore,
        caps: { daily: e.SERPAPI_DAILY_CAP, monthly: e.SERPAPI_MONTHLY_CAP },
        onReplyError: recordReplyErrors(".data/serpapi-reply-errors.jsonl"),
      })
    : fixtureNews();

const report = await runDigest(
  {
    now,
    siteUrl: e.SITE_URL,
    store: sqlSubscriptionStore,
    mailer: dryRun ? printMailer : mailer(),
    getTrek,
    allSlugs,
    fetchForecast: (t) => forecasts.fetch(t),
    fetchNews: (t) => news.fetch(t),
    summarise: (t, items) => summariseNews(chatModel(), t.name, items),
    saveConditions,
  },
  { sweep, resend },
);

console.log(
  `digest ${dryRun ? "(dry run) " : ""}done: ${report.treksChecked} trek(s) checked, ${report.emailsSent} email(s), ${report.expired} expired subscription(s) removed, forecasts ${e.FORECAST_MODE}, news ${e.NEWS_MODE}${sweep ? ", weekly sweep" : ""}${resend ? ", resent" : ""}`,
);
const ff = report.forecastFailures;
if (ff.length > 0) console.warn(`  forecast unavailable for ${ff.length} of ${report.treksChecked} trek(s); their emails say so: ${ff.map((f) => `${f.slug} (${f.reason})`).join(", ")}`);
for (const err of report.errors) console.error(`  ! ${err}`);
await closeDb();
process.exit(exitCode(report));
