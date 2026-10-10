import type { Trek } from "./trek-schema";

export interface AltPoint {
  day: number; // x position in days; highs sit mid-day
  altitude: number;
  label: string;
}

export interface AltitudeSeries {
  // Where you sleep each night, plus start and finish. Index = day; null = not sourced.
  line: (AltPoint | null)[];
  // A day's high point, when it is above both ends of that day.
  highs: AltPoint[];
  days: number;
  // False when our sources don't lay out the daily stages at all.
  stagesKnown: boolean;
  // Nights whose camp altitude isn't sourced.
  unknownCampDays: number[];
}

type TrekShape = Pick<Trek, "start" | "end" | "itinerary" | "highest_point" | "days">;

export function altitudeSeries(t: TrekShape): AltitudeSeries {
  const at = (day: number, altitude: number | null, label: string): AltPoint | null =>
    altitude === null ? null : { day, altitude, label };

  if (t.itinerary.length === 0) {
    const days = t.days ?? 1;
    const top = t.highest_point.altitude_m;
    const line: (AltPoint | null)[] = Array.from({ length: days + 1 }, () => null);
    line[0] = at(0, t.start.altitude_m, t.start.name);
    line[days] = at(days, t.end.altitude_m, t.end.name);
    return {
      line,
      highs: top === null ? [] : [{ day: days / 2, altitude: top, label: t.highest_point.name }],
      days,
      stagesKnown: false,
      unknownCampDays: Array.from({ length: Math.max(0, days - 1) }, (_, i) => i + 1),
    };
  }

  const n = t.itinerary.length;
  const line: (AltPoint | null)[] = [at(0, t.start.altitude_m, t.start.name)];
  const unknownCampDays: number[] = [];
  t.itinerary.forEach((d, i) => {
    const last = i === n - 1;
    if (!last && d.camp_altitude_m === null) unknownCampDays.push(d.day);
    const alt = d.camp_altitude_m ?? (last ? t.end.altitude_m : null);
    line.push(at(d.day, alt, last && d.camp_altitude_m === null ? t.end.name : d.to));
  });

  const highs: AltPoint[] = [];
  t.itinerary.forEach((d, i) => {
    if (d.max_altitude_m === null) return;
    const before = line[i]?.altitude ?? -Infinity;
    const after = line[i + 1]?.altitude ?? -Infinity;
    if (d.max_altitude_m > before && d.max_altitude_m > after) {
      const label = d.max_altitude_m === t.highest_point.altitude_m ? t.highest_point.name : d.to;
      highs.push({ day: d.day - 0.5, altitude: d.max_altitude_m, label });
    }
  });

  return { line, highs, days: n, stagesKnown: true, unknownCampDays };
}

// Line segments to draw: only between two known points of the same day, passing through
// that day's high point if it has one. Nothing is drawn across an unknown camp.
export function profileSegments(s: AltitudeSeries): AltPoint[][] {
  if (!s.stagesKnown) return [];
  const out: AltPoint[][] = [];
  for (let day = 1; day <= s.days; day++) {
    const a = s.line[day - 1];
    const b = s.line[day];
    if (!a || !b) continue;
    const high = s.highs.find((h) => h.day === day - 0.5);
    out.push(high ? [a, high, b] : [a, b]);
  }
  return out;
}

export function altitudeNote(s: AltitudeSeries): string | null {
  if (!s.stagesKnown) return "Camp altitude not known: our sources don't give the daily stages.";
  const d = s.unknownCampDays;
  if (d.length === 0) return null;
  const list = d.length === 1 ? `${d[0]}` : `${d.slice(0, -1).join(", ")} and ${d.at(-1)}`;
  return `Camp altitude not known for day${d.length === 1 ? "" : "s"} ${list}.`;
}

export function knownPoints(s: AltitudeSeries): number {
  return s.line.filter(Boolean).length + s.highs.length;
}

export function niceRange(values: number[]): { lo: number; hi: number; step: number } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const step = span > 2500 ? 1000 : span > 800 ? 500 : 250;
  return { lo: Math.max(0, Math.floor((min - step / 4) / step) * step), hi: Math.ceil((max + step / 4) / step) * step, step };
}
