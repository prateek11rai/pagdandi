import type { Trek } from "@/lib/trek-schema";

// A synthetic trek for tests. Not real data.
export function sampleTrek(slug = "example-trek", name = "Example Trek"): Trek {
  return {
    slug,
    name,
    name_local: null,
    state: "Uttarakhand",
    region: "uttarakhand",
    area: "Example district",
    difficulty: "moderate",
    days: 2,
    distance_km: 12,
    highest_point: { name: "Example Top", altitude_m: 3200 },
    start: { name: "Base", lat: 30.1, lon: 78.1, altitude_m: 2000, coords_source: "osm" },
    end: { name: "Base", lat: 30.1, lon: 78.1, altitude_m: 2000, coords_source: "osm" },
    getting_there: { railhead: { name: "Example Junction", distance_km: 100 }, airport: null, road_head: "Base", notes: null },
    season_months: [4, 5, 10],
    permits: null,
    last_mobile_signal: null,
    budget_inr: { min: 3000, max: 6000, basis: "Pagdandi rough estimate: test" },
    itinerary: [
      { day: 1, from: "Base", to: "Camp", camp_altitude_m: 2700, max_altitude_m: null, distance_km: 6 },
      { day: 2, from: "Camp", to: "Base", camp_altitude_m: null, max_altitude_m: 3200, distance_km: 6 },
    ],
    highlights: ["A ridge with long views."],
    audio_script: null,
    photo: null,
    weak_sources: [],
    sources: [
      {
        url: "https://example.org/source",
        title: "Example source",
        accessed: "2026-10-11",
        supports: ["highest_point", "start", "end", "days", "distance_km", "season_months", "getting_there", "itinerary"],
      },
    ],
    facts_checked_by: null,
    last_reviewed: "2026-10-11",
  };
}
