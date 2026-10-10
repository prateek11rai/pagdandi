import "server-only";
import type { BudgetStore } from "./budget";
import { sql } from "./db";

export const sqlBudgetStore: BudgetStore = {
  async incrementIfBelow(service, period, periodStart, cap) {
    const rows = await sql()<{ used: number }[]>`
      insert into api_budget (service, period_kind, period_start, used) values (${service}, ${period}, ${periodStart}, 1)
      on conflict (service, period_kind, period_start) do update set used = api_budget.used + 1
      where api_budget.used < ${cap}
      returning used
    `;
    if (rows.length === 0) return null;
    // A fresh row starts at 1, so a cap of 0 must be checked here too.
    return rows[0]!.used <= cap ? rows[0]!.used : null;
  },
  async decrement(service, period, periodStart) {
    await sql()`update api_budget set used = greatest(used - 1, 0) where service = ${service} and period_kind = ${period} and period_start = ${periodStart}`;
  },
};
