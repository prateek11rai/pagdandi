import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import { sqlSubscriptionStore as store } from "@/lib/subscriptions-sql";
import { hashToken } from "@/lib/tokens";
import { closeDb, prepareDatabase } from "./stack";

beforeAll(async () => {
  await prepareDatabase();
  await sql()`delete from subscriptions`;
  await store.insertPending({ email: "admin@example.com", slug: "kedarkantha", travelDate: "2099-12-31", confirmHash: hashToken("dc"), unsubscribeHash: hashToken("du") });
  await store.activateByConfirmHash(hashToken("dc"));
});
afterAll(async () => {
  await sql()`delete from subscriptions`;
  await closeDb();
});

describe("pnpm digest --dry-run, end to end", () => {
  it("checks conditions and prints one masked email with redacted tokens", async () => {
    const { stdout } = await promisify(execFile)("pnpm", ["-s", "digest", "--dry-run"], {
      env: { ...process.env },
      timeout: 170_000,
    });
    expect(stdout).toContain("=== To: a***@example.com");
    expect(stdout).toMatch(/Subject: Kedarkantha · \d+ days to go · /);
    expect(stdout).toContain("ONE THING TO DO OUTSIDE TODAY");
    expect(stdout).toContain("token=REDACTED");
    expect(stdout).not.toContain("admin@example.com");
    expect(stdout).toMatch(/digest \(dry run\) done: \d+ trek\(s\) checked, 1 email/);
  });
});
