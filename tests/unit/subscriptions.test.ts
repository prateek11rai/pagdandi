import { describe, expect, it } from "vitest";
import { confirm, expire, MemorySubscriptionStore, subscribe, unsubscribe, unsubscribeUrlFor, type Mailer } from "@/lib/subscriptions";

const NOW = new Date("2026-10-11T03:00:00Z"); // 08:30 IST, 11 Oct
const ADMIN = "admin@example.com";

function setup() {
  const sent: { to: string; subject: string; text: string }[] = [];
  const mailer: Mailer = { send: async (m) => void sent.push(m) };
  const store = new MemorySubscriptionStore(() => NOW);
  const deps = { store, mailer, adminEmail: ADMIN, siteUrl: "https://example.org", trek: { name: "Example Trek", state: "Uttarakhand", slug: "example-trek" }, now: NOW };
  return { sent, store, deps };
}
const tokenIn = (text: string, path: string) => new RegExp(`${path}\\?token=([A-Za-z0-9_-]+)`).exec(text)![1]!;

describe("subscription lifecycle", () => {
  it("shows a preview to anyone but the admin and stores nothing", async () => {
    const { sent, store, deps } = setup();
    const r = await subscribe({ email: "someone@example.net", slug: "triund", travelDate: "2026-11-01" }, deps);
    expect(r.kind).toBe("preview");
    expect(store.rows).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it("double opt-in: pending until the confirmation link is used", async () => {
    const { sent, store, deps } = setup();
    expect((await subscribe({ email: "Admin@Example.com", slug: "triund", travelDate: "2026-11-01" }, deps)).kind).toBe("pending");
    expect(store.rows[0]!.status).toBe("pending");
    expect(await store.listActive()).toHaveLength(0);
    const token = tokenIn(sent[0]!.text, "/api/confirm");
    expect(await confirm(token, store)).not.toBeNull();
    expect(await store.listActive()).toHaveLength(1);
    expect(await confirm(token, store)).toBeNull(); // single use
  });

  it("stores only hashes, never the tokens", async () => {
    const { sent, store, deps } = setup();
    await subscribe({ email: ADMIN, slug: "triund", travelDate: "2026-11-01" }, deps);
    const token = tokenIn(sent[0]!.text, "/api/confirm");
    expect(JSON.stringify(store.rows)).not.toContain(token);
  });

  it("unsubscribes from the confirmation email and from any daily email", async () => {
    const { sent, store, deps } = setup();
    await subscribe({ email: ADMIN, slug: "triund", travelDate: "2026-11-01" }, deps);
    await confirm(tokenIn(sent[0]!.text, "/api/confirm"), store);
    const daily = await unsubscribeUrlFor(store.rows[0]!, store, "https://example.org");
    expect(await unsubscribe(tokenIn(daily, "/api/unsubscribe"), store)).toBe(true);
    expect(store.rows).toHaveLength(0);
    expect(await unsubscribe(tokenIn(sent[0]!.text, "/api/unsubscribe"), store)).toBe(false);
  });

  it("deletes a subscription the day after the travel date", async () => {
    const { store, deps } = setup();
    await subscribe({ email: ADMIN, slug: "triund", travelDate: "2026-10-12" }, deps);
    await store.activateByConfirmHash(store.rows[0]!.confirmHash!);
    expect(await expire(store, new Date("2026-10-12T03:00:00Z"))).toBe(0); // travel day: still there
    expect(await expire(store, new Date("2026-10-13T03:00:00Z"))).toBe(1); // day after: gone
  });

  it("drops unconfirmed sign-ups after two days", async () => {
    const { store, deps } = setup();
    await subscribe({ email: ADMIN, slug: "triund", travelDate: "2026-12-01" }, deps);
    expect(await expire(store, new Date("2026-10-13T03:00:00Z"))).toBe(1);
  });

  it("rejects travel dates in the past", async () => {
    const { deps } = setup();
    expect((await subscribe({ email: ADMIN, slug: "triund", travelDate: "2026-10-11" }, deps)).kind).toBe("invalid");
  });
});
