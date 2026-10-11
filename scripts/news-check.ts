// One live SerpApi Google News search for one trek, through the digest's budget caps, to check the key and Gemma's
// summary by hand. Saves nothing but the budget counters. Usage: pnpm news:check --trek <slug>
import { sqlBudgetStore } from "../src/lib/budget-sql";
import { serpApiNews } from "../src/lib/conditions/news";
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

const r = await newsCheck(args.slug, {
  getTrek,
  budget: sqlBudgetStore,
  caps,
  news: serpApiNews({ apiKey: e.SERPAPI_API_KEY!, budget: sqlBudgetStore, caps }),
  summarise: (t, items) => summariseNews(chatModel(), t.name, items),
});

if (!r.ok) {
  console.error(r.reason);
} else {
  console.log(`${r.trek.name}: one live Google News search`);
  console.log(`Query: ${r.news.query}`);
  console.log(`${r.news.items.length} headline(s), newest first:`);
  for (const it of r.news.items) console.log(`  ${it.date?.slice(0, 10) ?? "no date   "}  ${it.source ?? "unknown source"}: ${it.title}`);
  console.log("Gemma's summary:");
  if (r.summaryError) console.log(`  (failed: ${r.summaryError})`);
  else if (!r.summary || r.summary.bullets.length === 0) console.log("  nothing a trekker needs to know");
  else for (const b of r.summary.bullets) console.log(`  - ${b.text} (${b.date?.slice(0, 10) ?? "no date"}) ${b.url}`);
}
if (r.usage) console.log(`SerpApi budget (IST): today ${r.usage.day} of ${caps.daily}, this month ${r.usage.month} of ${caps.monthly}`);
await closeDb();
process.exit(r.ok ? 0 : 1);
