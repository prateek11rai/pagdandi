// Render Cron, 07:00 IST. `pnpm digest --dry-run` prints the emails (recipient masked, tokens redacted)
// instead of sending them; `--sweep` refreshes every trek (the weekly run does this on Sundays).
import { sqlBudgetStore } from "@/lib/budget-sql";
import { fetchForecast } from "@/lib/conditions/open-meteo";
import { fixtureNews, serpApiNews } from "@/lib/conditions/news";
import { saveConditions } from "@/lib/conditions/store";
import { summariseNews } from "@/lib/conditions/summarize";
import type { NewsPayload } from "@/lib/conditions/types";
import { closeDb, sql } from "@/lib/db";
import { mailer } from "@/lib/email";
import { loadEnv } from "@/lib/env";
import { sqlSubscriptionStore } from "@/lib/subscriptions-sql";
import type { Mailer } from "@/lib/subscriptions";
import { allSlugs, getTrek } from "@/lib/treks";
import { chatModel } from "@/mastra/model";
import { runDigest } from "./digest-core";

const e = loadEnv("digest");
const dryRun = process.argv.includes("--dry-run");
const now = new Date();
const sweep = process.argv.includes("--sweep") || new Date(now.getTime() + 5.5 * 3600_000).getUTCDay() === 0;

const printMailer: Mailer = {
  async send(m) {
    const at = m.to.indexOf("@");
    const masked = at > 1 ? `${m.to[0]}***${m.to.slice(at)}` : "***";
    const redact = (s: string) => s.replace(/token=[A-Za-z0-9_-]+/g, "token=REDACTED");
    console.log(`\n=== To: ${masked}\nSubject: ${m.subject}\n\n${redact(m.text)}\n`);
  },
};

const news =
  e.NEWS_MODE === "serpapi"
    ? serpApiNews({ apiKey: e.SERPAPI_API_KEY!, budget: sqlBudgetStore, caps: { daily: e.SERPAPI_DAILY_CAP, monthly: e.SERPAPI_MONTHLY_CAP } })
    : fixtureNews();

const report = await runDigest(
  {
    now,
    siteUrl: e.SITE_URL,
    store: sqlSubscriptionStore,
    mailer: dryRun ? printMailer : mailer(),
    getTrek,
    allSlugs,
    fetchForecast,
    fetchNews: (t) => news.fetch(t),
    async previousNewsUrls(slug) {
      const [row] = await sql()<{ payload: NewsPayload }[]>`
        select payload from conditions where slug = ${slug} and kind = 'news' order by fetched_at desc limit 1`;
      return new Set((row?.payload.items ?? []).map((i) => i.url));
    },
    summarise: (t, items) => summariseNews(chatModel(), t.name, items),
    saveConditions,
  },
  { sweep },
);

console.log(
  `digest ${dryRun ? "(dry run) " : ""}done: ${report.treksChecked} trek(s) checked, ${report.emailsSent} email(s), ${report.expired} expired subscription(s) removed, news source ${e.NEWS_MODE}${sweep ? ", weekly sweep" : ""}`,
);
for (const err of report.errors) console.error(`  ! ${err}`);
await closeDb();
process.exit(report.budgetExceeded || report.errors.length > 0 ? 1 : 0);
