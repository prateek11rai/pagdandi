import { describe, expect, it } from "vitest";
import { BudgetExceededError, MemoryBudgetStore, periodsIST, reserve } from "@/lib/budget";

const caps = { daily: 3, monthly: 5 };
const day1 = new Date("2026-10-11T02:00:00Z");
const day2 = new Date("2026-10-12T02:00:00Z");

describe("SerpApi budget caps", () => {
  it("allows calls up to the daily cap, then throws", async () => {
    const store = new MemoryBudgetStore();
    for (let i = 0; i < 3; i++) await reserve(store, "serpapi", caps, day1);
    await expect(reserve(store, "serpapi", caps, day1)).rejects.toThrowError(BudgetExceededError);
  });

  it("does not count a refused call against the month", async () => {
    const store = new MemoryBudgetStore();
    for (let i = 0; i < 3; i++) await reserve(store, "serpapi", caps, day1);
    await expect(reserve(store, "serpapi", caps, day1)).rejects.toThrow(/daily cap/);
    expect(store.counts.get("serpapi:month:2026-10-01")).toBe(3);
  });

  it("enforces the monthly cap across days", async () => {
    const store = new MemoryBudgetStore();
    for (let i = 0; i < 3; i++) await reserve(store, "serpapi", caps, day1);
    for (let i = 0; i < 2; i++) await reserve(store, "serpapi", caps, day2);
    const err = await reserve(store, "serpapi", caps, day2).catch((e) => e);
    expect(err).toBeInstanceOf(BudgetExceededError);
    expect(err.period).toBe("month");
  });

  it("uses IST calendar days", () => {
    expect(periodsIST(new Date("2026-10-11T19:00:00Z"))).toEqual({ day: "2026-10-12", month: "2026-10-01" });
  });
});
