// Subscribe ADMIN_EMAIL to one trek's daily updates and send the confirmation email, the same way the sign-up form
// does, without typing or printing the address. EMAIL_MODE decides whether it's sent (smtp) or written to
// .data/outbox/ (dry-run). Usage: pnpm subscribe:admin --trek <slug> --date YYYY-MM-DD
import { closeDb } from "../src/lib/db";
import { mailer } from "../src/lib/email";
import { loadEnv } from "../src/lib/env";
import { parseSubscribeAdminArgs, subscribe } from "../src/lib/subscriptions";
import { sqlSubscriptionStore } from "../src/lib/subscriptions-sql";
import { getTrek } from "../src/lib/treks";

const args = parseSubscribeAdminArgs(process.argv.slice(2));
if ("error" in args) {
  console.error(args.error);
  process.exit(1);
}
const e = loadEnv("web");
const trek = await getTrek(args.slug);
if (!trek) {
  console.error(`No trek called "${args.slug}" in the database.`);
  await closeDb();
  process.exit(1);
}

const result = await subscribe(
  { email: e.ADMIN_EMAIL, slug: trek.slug, travelDate: args.travelDate },
  { store: sqlSubscriptionStore, mailer: mailer(), adminEmail: e.ADMIN_EMAIL, siteUrl: e.SITE_URL, trek: { name: trek.name, state: trek.state, slug: trek.slug } },
);
await closeDb();
if (result.kind === "invalid") {
  console.error(result.message);
  process.exit(1);
}
console.log(
  `${trek.name}, travel date ${args.travelDate}: pending until the admin clicks the link. Confirmation ${e.EMAIL_MODE === "smtp" ? "emailed to the admin over SMTP" : "written to .data/outbox/ (dry run)"}.`,
);
