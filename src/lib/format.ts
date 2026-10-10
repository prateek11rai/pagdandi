const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export function monthShort(m: number): string {
  return MONTHS[m - 1] ?? "?";
}

// [12, 1, 2, 3, 4] -> "Dec–Apr"; [5, 6, 9, 10] -> "May–Jun, Sep–Oct"
export function formatSeason(months: readonly number[]): string {
  const set = new Set(months);
  if (set.size === 0) return "Not known yet";
  if (set.size === 12) return "All year";
  const has = (m: number) => set.has(((m - 1 + 12) % 12) + 1);
  const runs: string[] = [];
  for (let m = 1; m <= 12; m++) {
    if (!has(m) || has(m - 1)) continue;
    let end = m;
    while (has(end + 1)) end++;
    const last = ((end - 1) % 12) + 1;
    runs.push(last === m ? monthShort(m) : `${monthShort(m)}–${monthShort(last)}`);
  }
  return runs.join(", ");
}

export function formatAltitude(m: number | null | undefined): string {
  return m == null ? "Not known yet" : `${m.toLocaleString("en-IN")} m`;
}

export function formatDays(days: number | null | undefined): string {
  if (days == null) return "Not known yet";
  return days === 1 ? "Day hike" : `${days} days`;
}

export function formatKm(km: number | null | undefined): string | null {
  return km == null ? null : `${km.toLocaleString("en-IN")} km`;
}

export function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

export function formatBudget(min: number, max: number): string {
  return min === max ? formatInr(min) : `${formatInr(min)}–${max.toLocaleString("en-IN")}`;
}

export function daysUntil(date: Date, today: Date = new Date()): number {
  const d = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d - t) / 86_400_000);
}
