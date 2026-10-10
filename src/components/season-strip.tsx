import { MONTH_NAMES } from "@/lib/format";

// Twelve cells, J to D, filled for the months the sources say are in season.
export function SeasonStrip({ months }: { months: number[] }) {
  const set = new Set(months);
  return (
    <ol className="grid grid-cols-12 gap-px" aria-label="Season by month">
      {MONTH_NAMES.map((name, i) => {
        const on = set.has(i + 1);
        return (
          <li
            key={name}
            className={`flex h-9 items-center justify-center text-xs font-semibold ${on ? "bg-moss text-paper" : "bg-ink/5 text-ink-muted"}`}
            aria-label={`${name}: ${on ? "in season" : "not in season"}`}
          >
            <span aria-hidden>{name[0]}</span>
          </li>
        );
      })}
    </ol>
  );
}
