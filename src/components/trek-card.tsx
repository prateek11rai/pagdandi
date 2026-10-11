import Link from "next/link";
import { Fragment } from "react";
import type { TrekCard as TrekCardData } from "@/lib/treks";
import { REGIONS, type Region } from "@/lib/trek-schema";
import { formatAltitude, formatBudgetShort, formatDaysShort, formatSeason } from "@/lib/format";
import { Badge } from "./ui/badge";

// A guidebook entry. Every value comes from the database row, never from the model.
export function TrekCard({
  trek,
  third = "season",
  reason,
  newTab = false,
}: {
  trek: TrekCardData;
  third?: "season" | "budget";
  reason?: string;
  newTab?: boolean; // in the chat, so following a card doesn't lose the plan
}) {
  return (
    <Link
      href={`/treks/${trek.slug}`}
      target={newTab ? "_blank" : undefined}
      className="block h-full rounded-xl border hairline bg-paper-raised px-4 py-3.5 text-ink no-underline transition-colors hover:border-moss hover:text-ink"
    >
      <h3 className="text-[19px] font-semibold">{trek.name}</h3>
      <p className="mb-2.5 mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[13px] text-ink-muted">
        {placeLine(trek.state, trek.region)
          .split(" · ")
          .map((part, i) => (
            <Fragment key={part}>
              {i > 0 && <span aria-hidden>·</span>}
              <span>{part}</span>
            </Fragment>
          ))}
        <Badge>{trek.difficulty}</Badge>
      </p>
      <dl className="grid grid-cols-[auto_auto_minmax(0,1fr)] gap-x-[18px] text-[13px]">
        <Fact label="Days" value={formatDaysShort(trek.days)} />
        <Fact label="Max alt" value={formatAltitude(trek.highestAltitudeM)} />
        {third === "season" ? (
          <Fact label="Season" value={formatSeason(trek.seasonMonths)} />
        ) : (
          <Fact label="Budget" value={formatBudgetShort(trek.budgetMinInr, trek.budgetMaxInr)} />
        )}
      </dl>
      {reason && <p className="mt-2.5 text-[13px] leading-snug">{reason}</p>}
      {newTab && <span className="sr-only"> (opens in a new tab)</span>}
    </Link>
  );
}

export function placeLine(state: string, region: string): string {
  const label = REGIONS[region as Region] ?? region;
  return label === state ? state : `${state} · ${label}`;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
