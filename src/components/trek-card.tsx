import Link from "next/link";
import type { TrekCard as TrekCardData } from "@/lib/treks";
import { REGIONS, type Region } from "@/lib/trek-schema";
import { formatAltitude, formatBudget, formatDays, formatSeason } from "@/lib/format";
import { AudioPlayer } from "./audio-player";
import { Badge } from "./ui/badge";

// A guidebook entry. Every value comes from the database row, never from the model.
export function TrekCard({ trek, reason }: { trek: TrekCardData; reason?: string }) {
  return (
    <article className="flex flex-col border-t-2 border-ink/80 pt-3">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">
            <Link href={`/treks/${trek.slug}`} className="text-ink no-underline hover:text-moss">
              {trek.name}
            </Link>
          </h3>
          <p className="text-sm text-ink-muted">{placeLine(trek.state, trek.region)}</p>
        </div>
        <Badge>{trek.difficulty}</Badge>
      </header>

      <dl className="mt-3 grid grid-cols-3 gap-x-3 border-y hairline py-2">
        <Fact label="Days" value={formatDays(trek.days)} />
        <Fact label="Max alt" value={formatAltitude(trek.highestAltitudeM)} />
        <Fact label="Season" value={formatSeason(trek.seasonMonths)} />
      </dl>

      {reason && <p className="mt-2 text-sm">{reason}</p>}

      <footer className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {formatBudget(trek.budgetMinInr, trek.budgetMaxInr)} <span className="label tracking-wider">est.</span>
        </p>
        {trek.audioUrl ? (
          <AudioPlayer src={trek.audioUrl} title={trek.name} compact />
        ) : (
          <span className="text-xs text-ink-muted">Audio soon</span>
        )}
      </footer>
    </article>
  );
}

export function placeLine(state: string, region: string): string {
  const label = REGIONS[region as Region] ?? region;
  return label === state ? state : `${state} · ${label}`;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="label">{label}</dt>
      <dd className="font-medium leading-snug">{value}</dd>
    </div>
  );
}
