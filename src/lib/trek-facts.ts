import "server-only";
import { sql } from "./db";
import type { TrekFacts } from "./fact-check";
import type { Trek } from "./trek-schema";

let cache: { at: number; facts: TrekFacts[] } | undefined;

export function factsOf(t: Trek): TrekFacts {
  const nums = (xs: (number | null | undefined)[]) => xs.filter((x): x is number => typeof x === "number");
  const g = t.getting_there;
  return {
    slug: t.slug,
    names: [t.name, t.slug.replace(/-/g, " "), t.name_local?.text].filter((n): n is string => !!n).map((n) => n.toLowerCase()),
    altitudesM: nums([
      t.highest_point.altitude_m,
      t.start.altitude_m,
      t.end.altitude_m,
      ...t.itinerary.flatMap((d) => [d.camp_altitude_m, d.max_altitude_m]),
    ]),
    days: nums([t.days, t.itinerary.length || null]),
    distancesKm: nums([t.distance_km, g.railhead?.distance_km, g.airport?.distance_km, ...t.itinerary.map((d) => d.distance_km)]),
    budget: { min: t.budget_inr.min, max: t.budget_inr.max },
  };
}

// All treks' checkable numbers, refreshed every five minutes.
export async function allTrekFacts(): Promise<TrekFacts[]> {
  if (cache && Date.now() - cache.at < 300_000) return cache.facts;
  const rows = await sql()<{ data: Trek }[]>`select data from treks`;
  cache = { at: Date.now(), facts: rows.map((r) => factsOf(r.data)) };
  return cache.facts;
}
