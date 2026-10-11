// One live SerpApi Google News search for one trek, through the digest's budget caps, to check the key and Gemma's
// summary by hand. Saves nothing but the budget counters. Usage: pnpm news:check --trek <slug>
// Diagnostic: --query "<text>" searches that text instead of the trek's own query (same client, same caps), and
// prints the shape of SerpApi's reply: its top-level keys, its error string and its status.
import { sqlBudgetStore } from "../src/lib/budget-sql";
import { recordReplyErrors, serpApiNews, type ReplyShape } from "../src/lib/conditions/news";
import { newsCheck, parseNewsCheckArgs } from "../src/lib/conditions/news-check";
import { summariseNews } from "../src/lib/conditions/summarize";
import { closeDb } from "../src/lib/db";
import { loadEnv } from "../src/lib/env";
import { getTrek } from "../src/lib/treks";
import { chatModel } from "../src/mastra/model";

const args = parseNewsCheckArgs(process.argv.slice(2));
if ("error" in args) {
  console.error(args.error);
  process.exit(1);
}
const e = loadEnv("news");
if (e.NEWS_MODE !== "serpapi") {
  console.error("NEWS_MODE isn't serpapi, so there is no live search to check. Set NEWS_MODE=serpapi in .env.");
  process.exit(1);
}
const caps = { daily: e.SERPAPI_DAILY_CAP, monthly: e.SERPAPI_MONTHLY_CAP };

let shape: ReplyShape | null = null;
const r = await newsCheck(
  args.slug,
  {
    getTrek,
    budget: sqlBudgetStore,
    caps,
    news: serpApiNews({
      apiKey: e.SERPAPI_API_KEY!,
      budget: sqlBudgetStore,
      caps,
      inspect: (s) => (shape = s),
      onReplyError: recordReplyErrors(".data/serpapi-reply-errors.jsonl"),
    }),
    summarise: (t, items) => summariseNews(chatModel(), t.name, items),
  },
  args.query,
);

if (!r.ok) {
  console.error(r.reason);
} else {
  console.log(`${r.trek.name}: one live Google News search${args.query ? " (diagnostic query, not the trek's own)" : ""}`);
  console.log(`Query: ${r.news.query}`);
  const s = shape as ReplyShape | null;
  if (args.query && s) {
    const n = (v: number | null) => (v === null ? "absent" : v);
    console.log(`Reply: keys ${s.keys.join(", ")}; news_results ${n(s.newsResults)}; top_news ${n(s.topNews)}; error ${s.error ?? "none"}; status ${s.status ?? "none"}`);
  }
  console.log(`${r.news.items.length} headline(s), newest first:`);
  for (const it of r.news.items) console.log(`  ${it.date?.slice(0, 10) ?? "no date   "}  ${it.source ?? "unknown source"}: ${it.title}\n              ${it.url}`);
  console.log("Gemma's summary:");
  if (r.summaryError) console.log(`  (failed: ${r.summaryError})`);
  else if (!r.summary || r.summary.bullets.length === 0) console.log("  nothing a trekker needs to know");
  else for (const b of r.summary.bullets) console.log(`  - ${b.text} (${b.date?.slice(0, 10) ?? "no date"}) ${b.url}`);
}
if (r.usage) console.log(`SerpApi budget (IST): today ${r.usage.day} of ${caps.daily}, this month ${r.usage.month} of ${caps.monthly}`);
await closeDb();
process.exit(r.ok ? 0 : 1);
