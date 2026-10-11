import { daysBetween, todayIST } from "./dates";
import { confirmationEmail } from "./email-template";
import { hashToken, newToken } from "./tokens";

export interface Subscription {
  id: string;
  email: string;
  slug: string;
  travelDate: string; // YYYY-MM-DD
  status: "pending" | "active";
  lastSentOn: string | null;
}

export interface SubscriptionStore {
  insertPending(s: { email: string; slug: string; travelDate: string; confirmHash: Buffer; unsubscribeHash: Buffer }): Promise<void>;
  activateByConfirmHash(hash: Buffer): Promise<Subscription | null>;
  deleteByUnsubscribeHash(hash: Buffer): Promise<boolean>;
  addUnsubscribeHash(subscriptionId: string, hash: Buffer): Promise<void>;
  deleteExpired(today: string): Promise<number>; // travel date before today, or pending for 2+ days
  listActive(): Promise<Subscription[]>;
  markSent(id: string, day: string): Promise<void>;
}

export interface Mailer {
  send(m: { to: string; subject: string; text: string; html: string; headers?: Record<string, string> }): Promise<void>;
}

export type SubscribeResult =
  | { kind: "preview" }
  | { kind: "invalid"; message: string }
  | { kind: "pending" };

export const PREVIEW_MESSAGE =
  "Preview: daily emails only go to the site admin until we have a domain. Nothing was stored.";

// Until the site has a domain, only the admin can subscribe. Anyone else gets the preview message and nothing is stored.
export async function subscribe(
  input: { email: string; slug: string; travelDate: string },
  deps: { store: SubscriptionStore; mailer: Mailer; adminEmail: string; siteUrl: string; trek: { name: string; state: string; slug: string }; now?: Date },
): Promise<SubscribeResult> {
  if (input.email.trim().toLowerCase() !== deps.adminEmail.trim().toLowerCase()) return { kind: "preview" };
  const today = todayIST(deps.now);
  const ahead = daysBetween(today, input.travelDate);
  if (ahead < 1) return { kind: "invalid", message: "Pick a travel date from tomorrow onwards." };
  if (ahead > 365) return { kind: "invalid", message: "Pick a travel date within the next year." };

  const confirm = newToken();
  const unsubscribe = newToken();
  await deps.store.insertPending({
    email: deps.adminEmail,
    slug: input.slug,
    travelDate: input.travelDate,
    confirmHash: confirm.hash,
    unsubscribeHash: unsubscribe.hash,
  });
  const confirmUrl = `${deps.siteUrl}/api/confirm?token=${confirm.token}`;
  const unsubscribeUrl = `${deps.siteUrl}/api/unsubscribe?token=${unsubscribe.token}`;
  const email = confirmationEmail({ siteUrl: deps.siteUrl, trek: deps.trek, travelDate: input.travelDate, confirmUrl, unsubscribeUrl });
  await deps.mailer.send({ to: deps.adminEmail, ...email, headers: unsubscribeHeaders(unsubscribeUrl) });
  return { kind: "pending" };
}

export const SUBSCRIBE_ADMIN_USAGE = "Usage: pnpm subscribe:admin --trek <slug> --date YYYY-MM-DD";

// `--trek <slug> --date YYYY-MM-DD`, in either order, and nothing else.
export function parseSubscribeAdminArgs(argv: string[]): { slug: string; travelDate: string } | { error: string } {
  const args = argv.filter((a) => a !== "--");
  const value = (flag: string) => (args.indexOf(flag) >= 0 ? args[args.indexOf(flag) + 1] : undefined);
  const slug = value("--trek");
  const travelDate = value("--date");
  if (args.length !== 4 || !slug || !travelDate) return { error: SUBSCRIBE_ADMIN_USAGE };
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return { error: `"${slug}" isn't a trek slug. ${SUBSCRIBE_ADMIN_USAGE}` };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(travelDate) || Number.isNaN(Date.parse(travelDate))) return { error: `"${travelDate}" isn't a date. ${SUBSCRIBE_ADMIN_USAGE}` };
  return { slug, travelDate };
}

export async function confirm(token: string, store: SubscriptionStore): Promise<Subscription | null> {
  return store.activateByConfirmHash(hashToken(token));
}

export async function unsubscribe(token: string, store: SubscriptionStore): Promise<boolean> {
  return store.deleteByUnsubscribeHash(hashToken(token));
}

// Rows are deleted the day after the travel date.
export async function expire(store: SubscriptionStore, now?: Date): Promise<number> {
  return store.deleteExpired(todayIST(now));
}

// A fresh unsubscribe link for one email.
export async function unsubscribeUrlFor(sub: Subscription, store: SubscriptionStore, siteUrl: string): Promise<string> {
  const t = newToken();
  await store.addUnsubscribeHash(sub.id, t.hash);
  return `${siteUrl}/api/unsubscribe?token=${t.token}`;
}

export function unsubscribeHeaders(url: string): Record<string, string> {
  return { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
}


// In-memory store for tests and local experiments.
export class MemorySubscriptionStore implements SubscriptionStore {
  rows: (Subscription & { confirmHash: Buffer | null; unsubscribeHash: Buffer; createdOn: string })[] = [];
  extraUnsubscribe: { hash: Buffer; id: string }[] = [];
  constructor(private now: () => Date = () => new Date()) {}
  async insertPending(s: { email: string; slug: string; travelDate: string; confirmHash: Buffer; unsubscribeHash: Buffer }) {
    this.rows = this.rows.filter((r) => !(r.email === s.email && r.slug === s.slug && r.travelDate === s.travelDate));
    this.rows.push({ ...s, id: String(this.rows.length + 1), status: "pending", lastSentOn: null, createdOn: todayIST(this.now()) });
  }
  async activateByConfirmHash(hash: Buffer) {
    const r = this.rows.find((x) => x.confirmHash?.equals(hash));
    if (!r) return null;
    r.status = "active";
    r.confirmHash = null;
    return r;
  }
  async deleteByUnsubscribeHash(hash: Buffer) {
    const before = this.rows.length;
    const viaExtra = this.extraUnsubscribe.find((x) => x.hash.equals(hash))?.id;
    this.rows = this.rows.filter((r) => !r.unsubscribeHash.equals(hash) && r.id !== viaExtra);
    return this.rows.length < before;
  }
  async addUnsubscribeHash(id: string, hash: Buffer) {
    this.extraUnsubscribe.push({ id, hash });
  }
  async deleteExpired(today: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter(
      (r) => r.travelDate >= today && !(r.status === "pending" && daysBetween(r.createdOn, today) >= 2),
    );
    return before - this.rows.length;
  }
  async listActive() {
    return this.rows.filter((r) => r.status === "active");
  }
  async markSent(id: string, day: string) {
    const r = this.rows.find((x) => x.id === id);
    if (r) r.lastSentOn = day;
  }
}
