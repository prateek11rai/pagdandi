import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { AltitudeChart } from "@/components/altitude-chart";
import { AudioPlayer } from "@/components/audio-player";
import { SeasonStrip } from "@/components/season-strip";
import { SubscribeForm } from "@/components/subscribe-form";
import { TakeItOnTheTrail } from "@/components/take-it-on-the-trail";
import { ConditionsPanel } from "@/components/conditions-panel";
import { formatAltitude, formatBudget, formatDays, formatKm, formatSeason } from "@/lib/format";
import { ALTITUDE_SAFETY_THRESHOLD_M, REGIONS, type Trek } from "@/lib/trek-schema";
import { audioUrl, getTrek } from "@/lib/treks";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const trek = await getTrek((await params).slug);
  if (!trek) return { title: "Trek not found" };
  return {
    title: `${trek.name}, ${trek.state}`,
    description: `${formatDays(trek.days)} · highest point ${formatAltitude(trek.highest_point.altitude_m)} · ${formatSeason(trek.season_months)}. ${trek.highlights[0] ?? ""}`,
  };
}

export default async function TrekPage({ params }: Props) {
  const { slug } = await params;
  const trek = await getTrek(slug);
  if (!trek) notFound();
  const audio = audioUrl(trek.slug);
  const top = trek.highest_point.altitude_m;
  const usesOsm = trek.start.coords_source === "osm" || trek.end.coords_source === "osm";

  return (
    <article>
      <header className="relative isolate overflow-hidden border-b hairline">
        <div className="mx-auto max-w-4xl px-4 pb-6 pt-8 sm:px-6 sm:pt-12">
          <p className="label no-print">
            <Link href="/" className="no-underline">
              Treks
            </Link>{" "}
            / {REGIONS[trek.region]}
          </p>
          <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">
            {trek.name}
            {trek.name_local && (
              <span
                lang={trek.name_local.lang}
                className={`ml-3 align-middle text-2xl font-normal text-ink-muted sm:text-3xl `}
              >
                {trek.name_local.text}
              </span>
            )}
          </h1>
          <p className="mt-1 text-lg text-ink-muted">
            {trek.state}
            {trek.area ? ` · ${trek.area}` : ""}
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-y hairline py-3 sm:grid-cols-5">
            <Fact label="Days" value={formatDays(trek.days)} />
            <Fact label="Max alt" value={formatAltitude(top)} />
            <Fact label="Season" value={formatSeason(trek.season_months)} />
            <Fact label="Difficulty" value={trek.difficulty[0]!.toUpperCase() + trek.difficulty.slice(1)} />
            <Fact
              label="Budget (est.)"
              value={formatBudget(trek.budget_inr.min, trek.budget_inr.max)}
              note="Rough estimate per person from the railhead or airport. Not a quote."
            />
          </dl>
        </div>
      </header>

      <div className="mx-auto grid max-w-4xl gap-10 px-4 py-8 sm:px-6">
        {top !== null && top > ALTITUDE_SAFETY_THRESHOLD_M && <AltitudeNote top={top} />}

        <Section id="listen" title="Listen" className="no-print">
          <p className="mb-3 text-ink-muted">Why this trek matters and what you&apos;ll see, in about a minute and a half.</p>
          {audio ? (
            <AudioPlayer src={audio} title={trek.name} download />
          ) : (
            <p className="text-ink-muted">The audio intro for this trek is still being recorded.</p>
          )}
        </Section>

        <Section id="altitude" title="Altitude by day">
          <AltitudeChart trek={trek} />
        </Section>

        <Section id="days" title="Day by day">
          <DayByDay trek={trek} />
        </Section>

        <Section id="getting-there" title="Getting there">
          <GettingThere trek={trek} />
        </Section>

        <div className="grid gap-10 sm:grid-cols-2">
          <Section id="permits" title="Permits">
            <p>{trek.permits ?? <NotKnown />}</p>
          </Section>
          <Section id="signal" title="Last mobile signal">
            <p>{trek.last_mobile_signal ?? <NotKnown />}</p>
          </Section>
        </div>

        <Section id="when" title="When to go">
          <SeasonStrip months={trek.season_months} />
          <p className="mt-2 text-sm text-ink-muted">{formatSeason(trek.season_months)}, according to the sources below.</p>
        </Section>

        <Section id="highlights" title="What you'll see">
          <ul className="list-disc space-y-1 pl-5">
            {trek.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </Section>

        <Section id="conditions" title="Today's conditions" className="no-print">
          <ConditionsPanel trek={trek} />
        </Section>

        <Section id="trail" title="Take it on the trail" className="no-print">
          <TakeItOnTheTrail audio={audio} />
        </Section>

        <Section id="updates" title="Get daily updates" className="no-print">
          <SubscribeForm slug={trek.slug} trekName={trek.name} />
        </Section>

        <Section id="sources" title="Sources">
          <Sources trek={trek} usesOsm={usesOsm} />
        </Section>
      </div>
    </article>
  );
}

function Section({
  id,
  title,
  children,
  className = "",
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`min-w-0 ${className}`}>
      <h2 id={`${id}-h`} className="mb-3 border-b hairline pb-1 text-2xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="font-serif text-lg font-semibold" title={note}>
        {value}
      </dd>
    </div>
  );
}

function NotKnown() {
  return <span className="text-ink-muted">Not known yet.</span>;
}

function AltitudeNote({ top }: { top: number }) {
  return (
    <aside className="flex gap-3 border-l-4 border-clay bg-paper-raised p-4" aria-label="Altitude safety">
      <AlertTriangle aria-hidden className="mt-1 size-5 shrink-0 text-clay" />
      <div className="text-[0.975rem]">
        <p>
          <strong>This trek goes to {formatAltitude(top)}.</strong> Above about 3,500 m, altitude sickness becomes more
          likely. Climb gradually, drink water, and turn back if headache, nausea or breathlessness get worse.
        </p>
        <p className="mt-1 text-ink-muted">
          This is not medical advice and not a substitute for a licensed local guide. Read the official advice from the
          state tourism or forest department before you go.
        </p>
      </div>
    </aside>
  );
}

function DayByDay({ trek }: { trek: Trek }) {
  if (trek.itinerary.length === 0) return <NotKnown />;
  return (
    <ol className="divide-y divide-rule">
      {trek.itinerary.map((d) => {
        const facts = [
          d.camp_altitude_m !== null ? `camp ${formatAltitude(d.camp_altitude_m)}` : null,
          d.max_altitude_m !== null ? `high point ${formatAltitude(d.max_altitude_m)}` : null,
          formatKm(d.distance_km),
        ].filter(Boolean);
        return (
          <li key={d.day} className="grid grid-cols-[3.5rem_1fr] gap-2 py-2">
            <span className="label pt-1">Day {d.day}</span>
            <div>
              <p className="font-medium">
                {d.from} → {d.to}
              </p>
              {facts.length > 0 && <p className="text-sm text-ink-muted">{facts.join(" · ")}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function GettingThere({ trek }: { trek: Trek }) {
  const g = trek.getting_there;
  const rows: [string, React.ReactNode][] = [
    ["Road head", g.road_head ?? <NotKnown />],
    [
      "Railhead",
      g.railhead ? `${g.railhead.name}${g.railhead.distance_km !== null ? `, ${formatKm(g.railhead.distance_km)} by road` : ""}` : <NotKnown />,
    ],
    [
      "Airport",
      g.airport
        ? `${g.airport.name}${g.airport.iata ? ` (${g.airport.iata})` : ""}${g.airport.distance_km !== null ? `, ${formatKm(g.airport.distance_km)} by road` : ""}`
        : <NotKnown />,
    ],
  ];
  return (
    <>
      <dl className="grid gap-2 sm:grid-cols-[8rem_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="label pt-1">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {g.notes && <p className="mt-3">{g.notes}</p>}
    </>
  );
}

function Sources({ trek, usesOsm }: { trek: Trek; usesOsm: boolean }) {
  return (
    <>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        {trek.sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} rel="noopener noreferrer">
              {s.title}
            </a>{" "}
            <span className="text-ink-muted">(accessed {s.accessed})</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-ink-muted">
        Last reviewed {trek.last_reviewed}
        {trek.facts_checked_by ? `, facts checked by ${trek.facts_checked_by}` : ""}. Text is our own, under{" "}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.
        {usesOsm && (
          <>
            {" "}
            Coordinates © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>.
          </>
        )}{" "}
        Spotted a mistake?{" "}
        <a href={`https://github.com/prateek11rai/pagdandi/blob/main/data/treks/${trek.slug}.yaml`}>Edit this trek</a>.
      </p>
    </>
  );
}
