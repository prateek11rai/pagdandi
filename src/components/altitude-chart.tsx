import { altitudeNote, altitudeSeries, knownPoints, niceRange, profileSegments, type AltPoint } from "@/lib/altitude";
import { ALTITUDE_SAFETY_THRESHOLD_M, type Trek } from "@/lib/trek-schema";
import { formatAltitude } from "@/lib/format";

const W = 560;
const H = 260;
const M = { top: 24, right: 18, bottom: 42, left: 60 };

export function AltitudeChart({ trek, figure = 1 }: { trek: Trek; figure?: number }) {
  const s = altitudeSeries(trek);
  if (knownPoints(s) < 2) {
    return (
      <p className="text-ink-muted">
        Altitude by day: not known yet. Our sources don&apos;t give camp altitudes for this trek.
      </p>
    );
  }

  const pts = [...s.line.filter((p): p is AltPoint => p !== null), ...s.highs];
  const { lo, hi, step } = niceRange(pts.map((p) => p.altitude));
  const x = (day: number) => M.left + (day / s.days) * (W - M.left - M.right);
  const y = (alt: number) => M.top + (1 - (alt - lo) / (hi - lo)) * (H - M.top - M.bottom);

  // Drawn only where both ends of a day are known, through that day's high point if any.
  const segments = profileSegments(s).map(
    (seg) => `M${seg.map((p) => `${x(p.day)},${y(p.altitude)}`).join("L")}`,
  );
  const note = altitudeNote(s);
  const dayLabel = (d: number) =>
    d === 0 ? "Start" : !s.stagesKnown ? (d === s.days && s.line[d] ? "Finish" : null) : String(d);
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);
  const showSafety = ALTITUDE_SAFETY_THRESHOLD_M > lo && ALTITUDE_SAFETY_THRESHOLD_M < hi;
  const top = Math.max(...pts.map((p) => p.altitude));
  const description = `${s.line
    .filter((p): p is AltPoint => p !== null)
    .map((p) => `${p.day === 0 ? "Start" : `Day ${p.day}`}: ${p.label}, ${formatAltitude(p.altitude)}`)
    .join(". ")}. Highest point ${formatAltitude(top)}.${note ? ` ${note}` : ""}`;
  const titleId = `alt-title-${trek.slug}`;
  const descId = `alt-desc-${trek.slug}`;

  return (
    <figure className="m-0 print:max-w-[120mm]">
      <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        className="h-auto w-full min-w-[30rem]"
      >
        <title id={titleId}>{`Altitude by day, ${trek.name}`}</title>
        <desc id={descId}>{description}</desc>

        {ticks.map((v) => (
          <g key={v}>
            <line x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} stroke="var(--rule)" strokeWidth={0.75} />
            <text x={M.left - 8} y={y(v) + 4} textAnchor="end" className="fill-ink-muted text-[13px]">
              {v.toLocaleString("en-IN")}
            </text>
          </g>
        ))}
        <text x={14} y={M.top - 8} className="fill-ink-muted text-[11px] font-semibold tracking-[0.12em]">
          METRES
        </text>

        {showSafety && (
          <g>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={y(ALTITUDE_SAFETY_THRESHOLD_M)}
              y2={y(ALTITUDE_SAFETY_THRESHOLD_M)}
              stroke="var(--ink-muted)"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <text x={W - M.right} y={y(ALTITUDE_SAFETY_THRESHOLD_M) - 5} textAnchor="end" className="fill-ink-muted text-[11px]">
              3,500 m: acclimatise above here
            </text>
          </g>
        )}

        {Array.from({ length: s.days + 1 }, (_, d) => dayLabel(d)).map(
          (label, d) =>
            label && (
              <text key={d} x={x(d)} y={H - M.bottom + 18} textAnchor="middle" className="fill-ink-muted text-[13px]">
                {label}
              </text>
            ),
        )}
        {s.stagesKnown && (
          <text x={W - M.right} y={H - 6} textAnchor="end" className="fill-ink-muted text-[11px] font-semibold tracking-[0.12em]">
            DAY
          </text>
        )}

        <path d={segments.join("")} fill="none" stroke="var(--moss)" strokeWidth={2.25} strokeLinejoin="round" />
        {s.line.map(
          (p, i) =>
            p && (
              <circle key={i} cx={x(p.day)} cy={y(p.altitude)} r={4} fill="var(--paper)" stroke="var(--moss)" strokeWidth={2} />
            ),
        )}
        {s.highs.map((p) => (
          <g key={`h${p.day}`}>
            <path
              d={`M${x(p.day)},${y(p.altitude) - 7}l6,10h-12z`}
              fill="var(--clay)"
              stroke="var(--paper)"
              strokeWidth={1}
            />
            <text x={x(p.day)} y={y(p.altitude) - 11} textAnchor="middle" className="fill-ink text-[13px] font-semibold">
              {p.altitude.toLocaleString("en-IN")}
            </text>
          </g>
        ))}
      </svg>
      </div>
      <figcaption className="figure-caption mt-1">
        Fig. {figure}. Altitude by day. The line joins known altitudes, through each day&apos;s high point (triangles).
        {note && <span className="mt-1 block not-italic">{note}</span>}
      </figcaption>
    </figure>
  );
}
