import type { Trek } from "./trek-schema";

export interface AltPoint {
  day: number; // x position in days; highs sit mid-day
  altitude: number;
  label: string;
}

export interface AltitudeSeries {
  // Where you sleep each night (plus start and finish). null breaks the line.
  line: (AltPoint | null)[];
  // The day's high point, when it is above both ends of that day.
  highs: AltPoint[];
  days: number;
}

type TrekShape = Pick<Trek, "start" | "end" | "itinerary" | "highest_point">;

export function altitudeSeries(t: TrekShape): AltitudeSeries {
  const at = (day: number, altitude: number | null, label: string): AltPoint | null =>
    altitude === null ? null : { day, altitude, label };

  if (t.itinerary.length === 0) {
    const line = [at(0, t.start.altitude_m, t.start.name), at(1, t.end.altitude_m, t.end.name)];
    const top = t.highest_point.altitude_m;
    return { line, highs: top === null ? [] : [{ day: 0.5, altitude: top, label: t.highest_point.name }], days: 1 };
  }

  const n = t.itinerary.length;
  const line: (AltPoint | null)[] = [at(0, t.start.altitude_m, t.start.name)];
  t.itinerary.forEach((d, i) => {
    const last = i === n - 1;
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

  return { line, highs, days: n };
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
