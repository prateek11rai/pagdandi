import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Mail } from "lucide-react";
import { AltitudeChart } from "@/components/altitude-chart";
import { AudioPlayer } from "@/components/audio-player";
import { ConditionsPanel } from "@/components/conditions-panel";
import { AutoPrint, PrintButton } from "@/components/print";
import { actionClass } from "@/components/ui/action";
import { formatAltitude, formatBudget, formatDays, formatDaysShort, formatKm, formatSeason } from "@/lib/format";
import { ALTITUDE_SAFETY_THRESHOLD_M, type Trek } from "@/lib/trek-schema";
import { audioUrl, getTrek } from "@/lib/treks";
import { isWeak, weakLabel } from "@/lib/weak";

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
  const known = (v: string | null) => v ?? "Not known yet";

  return (
    <article className="mx-auto max-w-[1120px] px-4 pb-16 pt-8 shell:px-12 shell:pt-11">
      <AutoPrint />
      <p className="label no-print">
        <Link href="/treks" className="text-ink-muted no-underline hover:text-moss">
          Treks
        </Link>{" "}
        / {trek.state}
      </p>
      <h1 className="mb-0.5 mt-1 text-[32px] shell:text-[40px]">
        {trek.name}
        {trek.name_local && (
          <span lang={trek.name_local.lang} className="ml-3 font-normal text-ink-muted">
            {trek.name_local.text}
          </span>
        )}
      </h1>
      <p className="text-ink-muted">
        {trek.state}
        {trek.area && (
          <>
            <span aria-hidden className="mx-1.5">
              ·
            </span>
            {trek.area}
          </>
        )}
      </p>

      <dl className="my-4 flex flex-wrap gap-x-7 gap-y-3 border-y border-rule py-3">
        <Fact label="Days" value={known(trek.days === null ? null : formatDaysShort(trek.days))} weak={isWeak(trek, "days")} />
        <Fact label="Max alt" value={formatAltitude(top)} weak={isWeak(trek, "highest_point")} />
        <Fact label="Season" value={formatSeason(trek.season_months)} weak={isWeak(trek, "season_months")} />
        <Fact label="Difficulty" value={trek.difficulty[0]!.toUpperCase() + trek.difficulty.slice(1)} />
        <Fact
          label="Budget (est.)"
          value={formatBudget(trek.budget_inr.min, trek.budget_inr.max)}
          title="Our rough estimate per person from the railhead or airport. Not a quote."
        />
        <Fact label="Distance" value={known(formatKm(trek.distance_km))} weak={isWeak(trek, "distance_km")} />
      </dl>

      {top !== null && top > ALTITUDE_SAFETY_THRESHOLD_M && (
        <p className="mb-2.5 rounded-r-lg border-l-[3px] border-clay-ink bg-paper-deep px-3.5 py-2.5 text-sm">
          <strong>This trek goes to {formatAltitude(top)}.</strong> Above about 3,500 m, altitude sickness becomes more
          likely. Climb gradually, drink water, and turn back if headache, nausea or breathlessness get worse. Not medical
          advice, and not a substitute for a licensed local guide.
        </p>
      )}

      <div className="no-print flex flex-wrap gap-2">
        <Link href={`/updates?trek=${trek.slug}`} className={actionClass(true)}>
          <Mail aria-hidden strokeWidth={1.75} className="size-4" />
          Get daily updates
        </Link>
        <PrintButton className={actionClass()} />
        {audio ? (
          <a href={audio} download className={actionClass()}>
            <Download aria-hidden strokeWidth={1.75} className="size-4" />
            Download the audio intro
          </a>
        ) : (
          <span aria-disabled="true" className={actionClass(false, "cursor-not-allowed text-ink-muted hover:border-rule hover:text-ink-muted")}>
            <Download aria-hidden strokeWidth={1.75} className="size-4" />
            Audio intro not recorded yet
          </span>
        )}
      </div>

      <div className="@container">
        <div className="grid gap-x-7 @min-[50rem]:grid-cols-2">
          <div className="min-w-0">
            <Section id="listen" title="Listen" className="no-print">
              <p className="mb-2.5 text-ink-muted">Why this trek matters and what you&apos;ll see, in about a minute and a half.</p>
              {audio ? (
                <>
                  <AudioPlayer src={audio} title={trek.name} size="full" />
                  <p className="mt-2 text-xs text-ink-muted">
                    Narrated from the trek&apos;s sourced facts. Download it for the drive: it plays offline.
                  </p>
                </>
              ) : (
                <p className="text-ink-muted">The audio intro for this trek is still being recorded.</p>
              )}
            </Section>

            <Section id="days" title="Day by day" weak={isWeak(trek, "itinerary")}>
              <DayByDay trek={trek} />
              <div className="mt-5">
                <AltitudeChart trek={trek} />
              </div>
            </Section>

            <Section id="highlights" title="What you'll see">
              <ul className="list-disc space-y-1 pl-5">
                {trek.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </Section>
          </div>

          <div className="min-w-0">
            <Section id="getting-there" title="Getting there" weak={isWeak(trek, "getting_there")}>
              <GettingThere trek={trek} />
            </Section>

            <Section id="permits" title="Permits" weak={isWeak(trek, "permits")}>
              <p>{trek.permits ?? <NotKnown />}</p>
            </Section>

            <Section id="conditions" title="Today's conditions" className="no-print">
              <ConditionsPanel trek={trek} />
            </Section>

            <Section id="sources" title="Sources">
              <Sources trek={trek} />
            </Section>
          </div>
        </div>
      </div>
    </article>
  );
}

function WeakMark({ block = false }: { block?: boolean }) {
  return (
    <a
      href="#weak-sources"
      className={
        block
          ? "mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-clay-ink no-underline"
          : "ml-2 whitespace-nowrap font-sans text-xs font-normal text-clay-ink no-underline"
      }
    >
      {block ? (
        "weak source"
      ) : (
        <>
          <span aria-hidden className="mr-1">
            ·
          </span>
          weak source
        </>
      )}
    </a>
  );
}

function Section({
  id,
  title,
  weak = false,
  children,
  className = "",
}: {
  id: string;
  title: string;
  weak?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`min-w-0 ${className}`}>
      <h2 id={`${id}-h`} className="mb-2.5 mt-7 border-b border-rule pb-1 text-2xl">
        {title}
        {weak && <WeakMark />}
      </h2>
      {children}
    </section>
  );
}

function Fact({ label, value, weak = false, title }: { label: string; value: string; weak?: boolean; title?: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">{label}</dt>
      <dd className="font-serif text-[19px] font-semibold" title={title}>
        {value}
        {weak && <WeakMark block />}
      </dd>
    </div>
  );
}

function NotKnown() {
  return <span className="text-ink-muted">Not known yet.</span>;
}

function Rows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl>
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[90px_1fr] gap-2 border-b border-rule py-2">
          <dt className="pt-0.5 text-[11px] uppercase tracking-[0.12em] text-ink-muted">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function DayByDay({ trek }: { trek: Trek }) {
  if (trek.itinerary.length === 0) return <NotKnown />;
  return (
    <Rows
      rows={trek.itinerary.map((d) => {
        const facts = [
          d.camp_altitude_m !== null ? `camp ${formatAltitude(d.camp_altitude_m)}` : null,
          d.max_altitude_m !== null ? `high point ${formatAltitude(d.max_altitude_m)}` : null,
          formatKm(d.distance_km),
        ].filter(Boolean);
        return [
          `Day ${d.day}`,
          <>
            {d.from} → {d.to}
            {isWeak(trek, `itinerary.day${d.day}`) && !isWeak(trek, "itinerary") && <WeakMark />}
            {facts.length > 0 && <span className="block text-xs text-ink-muted">{facts.join(" · ")}</span>}
          </>,
        ];
      })}
    />
  );
}

function GettingThere({ trek }: { trek: Trek }) {
  const g = trek.getting_there;
  const km = (n: number | null) => (n !== null ? `, ${formatKm(n)} by road` : "");
  return (
    <>
      <Rows
        rows={[
          ["Road head", g.road_head ?? <NotKnown />],
          ["Railhead", g.railhead ? `${g.railhead.name}${km(g.railhead.distance_km)}` : <NotKnown />],
          ["Airport", g.airport ? `${g.airport.name}${g.airport.iata ? `, ${g.airport.iata}` : ""}${km(g.airport.distance_km)}` : <NotKnown />],
          [
            "Last signal",
            trek.last_mobile_signal ? (
              <>
                {trek.last_mobile_signal}
                {isWeak(trek, "last_mobile_signal") && <WeakMark />}
              </>
            ) : (
              <NotKnown />
            ),
          ],
        ]}
      />
      {g.notes && <p className="mt-3 text-ink-muted">{g.notes}</p>}
    </>
  );
}

function Sources({ trek }: { trek: Trek }) {
  const usesOsm = trek.start.coords_source === "osm" || trek.end.coords_source === "osm";
  const weak = trek.weak_sources ?? [];
  return (
    <div className="text-[13px]">
      {weak.length > 0 && (
        <div id="weak-sources" className="mb-3 scroll-mt-6 rounded-r-lg border-l-[3px] border-clay bg-paper-deep px-3.5 py-2.5">
          <p className="font-semibold">Weak sources</p>
          <p className="text-ink-muted">These facts rest on one source we couldn&apos;t fully trust:</p>
          <ul className="mt-1 space-y-0.5">
            {weak.map((w) => (
              <li key={w.field}>
                <strong>{weakLabel(w.field)}:</strong> {w.note}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ol className="list-decimal space-y-1 pl-5">
        {trek.sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} rel="noopener noreferrer">
              {s.title}
            </a>{" "}
            <span className="text-ink-muted">(accessed {s.accessed})</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-ink-muted">
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
    </div>
  );
}
