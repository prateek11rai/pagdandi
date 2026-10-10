import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sqlBudgetStore } from "@/lib/budget-sql";
import { reserve } from "@/lib/budget";
import { sql } from "@/lib/db";
import { sqlSubscriptionStore as store } from "@/lib/subscriptions-sql";
import { hashToken } from "@/lib/tokens";
import { closeDb, prepareDatabase } from "./stack";

beforeAll(async () => {
  await prepareDatabase();
  await sql()`delete from subscriptions`;
  await sql()`delete from api_budget where service = 'test'`;
});
afterAll(closeDb);

describe("SQL stores", () => {
  it("runs the subscription lifecycle", async () => {
    await store.insertPending({ email: "admin@example.com", slug: "triund", travelDate: "2099-01-01", confirmHash: hashToken("c"), unsubscribeHash: hashToken("u") });
    expect(await store.listActive()).toHaveLength(0);
    const sub = await store.activateByConfirmHash(hashToken("c"));
    expect(sub?.slug).toBe("triund");
    expect(await store.activateByConfirmHash(hashToken("c"))).toBeNull();
    await store.addUnsubscribeHash(sub!.id, hashToken("u2"));
    expect(await store.deleteByUnsubscribeHash(hashToken("u2"))).toBe(true);
    expect(await store.listActive()).toHaveLength(0);
  });

  it("deletes subscriptions after the travel date", async () => {
    await store.insertPending({ email: "admin@example.com", slug: "triund", travelDate: "2026-01-01", confirmHash: hashToken("c3"), unsubscribeHash: hashToken("u3") });
    await store.activateByConfirmHash(hashToken("c3"));
    expect(await store.deleteExpired("2026-01-02")).toBe(1);
  });

  it("enforces budget caps atomically in Postgres", async () => {
    const caps = { daily: 2, monthly: 3 };
    await reserve(sqlBudgetStore, "test", caps);
    await reserve(sqlBudgetStore, "test", caps);
    await expect(reserve(sqlBudgetStore, "test", caps)).rejects.toThrow(/daily cap/);
    const [row] = await sql()<{ used: number }[]>`select used from api_budget where service = 'test' and period_kind = 'month'`;
    expect(row!.used).toBe(2);
  });
});
