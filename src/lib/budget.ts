// Hard caps for paid APIs. Reserve before every call; an exceeded cap is an error, never a silent overrun.

export class BudgetExceededError extends Error {
  constructor(
    readonly service: string,
    readonly period: "day" | "month",
    readonly cap: number,
  ) {
    super(`${service} ${period === "day" ? "daily" : "monthly"} cap of ${cap} searches reached`);
  }
}

export interface BudgetStore {
  // Increment the counter only if it is below cap; return the new count, or null if the cap was hit.
  incrementIfBelow(service: string, period: "day" | "month", periodStart: string, cap: number): Promise<number | null>;
  // Undo one increment (used when the second counter refuses after the first one counted).
  decrement(service: string, period: "day" | "month", periodStart: string): Promise<void>;
  // How many calls this period has counted so far (0 if none).
  used(service: string, period: "day" | "month", periodStart: string): Promise<number>;
}

export interface Caps {
  daily: number;
  monthly: number;
}

// Calendar day and month in IST, which is when the daily job runs.
export function periodsIST(now: Date): { day: string; month: string } {
  const ist = new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
  return { day: ist, month: `${ist.slice(0, 7)}-01` };
}

export async function reserve(store: BudgetStore, service: string, caps: Caps, now = new Date()): Promise<void> {
  const { day, month } = periodsIST(now);
  if ((await store.incrementIfBelow(service, "month", month, caps.monthly)) === null) {
    throw new BudgetExceededError(service, "month", caps.monthly);
  }
  if ((await store.incrementIfBelow(service, "day", day, caps.daily)) === null) {
    await store.decrement(service, "month", month);
    throw new BudgetExceededError(service, "day", caps.daily);
  }
}

export class MemoryBudgetStore implements BudgetStore {
  readonly counts = new Map<string, number>();
  async incrementIfBelow(service: string, period: string, start: string, cap: number) {
    const k = `${service}:${period}:${start}`;
    const n = this.counts.get(k) ?? 0;
    if (n >= cap) return null;
    this.counts.set(k, n + 1);
    return n + 1;
  }
  async decrement(service: string, period: string, start: string) {
    const k = `${service}:${period}:${start}`;
    this.counts.set(k, Math.max(0, (this.counts.get(k) ?? 0) - 1));
  }
  async used(service: string, period: string, start: string) {
    return this.counts.get(`${service}:${period}:${start}`) ?? 0;
  }
}
