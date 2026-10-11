// Render the digest and the confirmation email for one trek into .data/outbox/ (gitignored), as .html and .txt, to
// look at before anything is sent. Always the recorded sample conditions; never sends, never touches the database.
// Usage: pnpm email:preview --trek <slug>
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fixtureForecast } from "../src/lib/conditions/open-meteo";
import { fixtureNews } from "../src/lib/conditions/news";
import { summariseNews } from "../src/lib/conditions/summarize";
import { addDays, todayIST } from "../src/lib/dates";
import { confirmationEmail } from "../src/lib/email-template";
import { loadEnv } from "../src/lib/env";
import { readTrekFiles } from "../src/lib/trek-files";
import { chatModel } from "../src/mastra/model";
import { composeDigest } from "../src/jobs/digest-core";

const args = process.argv.slice(2).filter((a) => a !== "--");
const slug = args[0] === "--trek" && args.length === 2 ? args[1]! : null;
const trek = readTrekFiles().find((r) => r.trek?.slug === slug)?.trek;
if (!trek) {
  console.error("Usage: pnpm email:preview --trek <slug> (a trek in data/treks/)");
  process.exit(1);
}
const e = loadEnv("model");
const today = todayIST();
const travelDate = addDays(today, 14);
const fake = (kind: string) => `${e.SITE_URL}/api/${kind}?token=preview-not-a-real-token`;

const forecast = await fixtureForecast().fetch(trek);
const news = await fixtureNews().fetch(trek);
const digest = composeDigest(
  trek,
  { id: "preview", email: "preview", slug: trek.slug, travelDate, status: "active", lastSentOn: null },
  { forecast, items: news.items, news: await summariseNews(chatModel(), trek.name, news.items), newsNote: null, newsIsSample: true },
  { today, siteUrl: e.SITE_URL, unsubscribeUrl: fake("unsubscribe") },
);
const confirm = confirmationEmail({
  siteUrl: e.SITE_URL,
  trek: { name: trek.name, state: trek.state, slug: trek.slug },
  travelDate,
  confirmUrl: fake("confirm"),
  unsubscribeUrl: fake("unsubscribe"),
});

const dir = path.join(process.cwd(), ".data", "outbox");
mkdirSync(dir, { recursive: true });
for (const [kind, m] of [["digest", digest], ["confirm", confirm]] as const) {
  const base = path.join(dir, `preview-${kind}-${trek.slug}`);
  writeFileSync(`${base}.html`, m.html);
  writeFileSync(`${base}.txt`, `Subject: ${m.subject}\n\n${m.text}`);
  console.log(`${path.relative(process.cwd(), base)}.html  ${m.subject}`);
}
console.log(`Recorded sample conditions, travel date ${travelDate}. Nothing was sent.`);
