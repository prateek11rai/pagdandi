import "server-only";
import { sql } from "./db";
import type { Subscription, SubscriptionStore } from "./subscriptions";

interface Row {
  id: string;
  email: string;
  slug: string;
  travel_date: string;
  status: "pending" | "active";
  last_sent_on: string | null;
}
const toSub = (r: Row): Subscription => ({
  id: r.id,
  email: r.email,
  slug: r.slug,
  travelDate: r.travel_date,
  status: r.status,
  lastSentOn: r.last_sent_on,
});
const COLS = "id, email, slug, to_char(travel_date, 'YYYY-MM-DD') as travel_date, status, to_char(last_sent_on, 'YYYY-MM-DD') as last_sent_on";

export const sqlSubscriptionStore: SubscriptionStore = {
  async insertPending(s) {
    await sql()`
      insert into subscriptions (email, slug, travel_date, confirm_token_hash, unsubscribe_token_hash)
      values (${s.email}, ${s.slug}, ${s.travelDate}, ${s.confirmHash}, ${s.unsubscribeHash})
      on conflict (email, slug, travel_date) do update set
        status = 'pending', confirm_token_hash = excluded.confirm_token_hash,
        unsubscribe_token_hash = excluded.unsubscribe_token_hash, created_at = now(), confirmed_at = null
    `;
  },
  async activateByConfirmHash(hash) {
    const [r] = await sql()<Row[]>`
      update subscriptions set status = 'active', confirmed_at = now(), confirm_token_hash = null
      where confirm_token_hash = ${hash} and status = 'pending'
      returning ${sql().unsafe(COLS)}
    `;
    return r ? toSub(r) : null;
  },
  async deleteByUnsubscribeHash(hash) {
    const rows = await sql()`
      delete from subscriptions
      where unsubscribe_token_hash = ${hash}
         or id = (select subscription_id from unsubscribe_tokens where hash = ${hash})
      returning id
    `;
    return rows.length > 0;
  },
  async addUnsubscribeHash(subscriptionId, hash) {
    await sql()`insert into unsubscribe_tokens (hash, subscription_id) values (${hash}, ${subscriptionId})`;
  },
  async deleteExpired(today) {
    const rows = await sql()`
      delete from subscriptions
      where travel_date < ${today}::date or (status = 'pending' and created_at < now() - interval '2 days')
      returning id
    `;
    return rows.length;
  },
  async listActive() {
    const rows = await sql()<Row[]>`select ${sql().unsafe(COLS)} from subscriptions where status = 'active' order by slug, id`;
    return rows.map(toSub);
  },
  async markSent(id, day) {
    await sql()`update subscriptions set last_sent_on = ${day}::date where id = ${id}`;
  },
};
