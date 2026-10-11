import type { Trek } from "./trek-schema";

const LABELS: Record<string, string> = {
  days: "Days",
  distance_km: "Distance",
  season_months: "Season",
  permits: "Permits",
  getting_there: "Getting there",
  highest_point: "Max alt",
  last_mobile_signal: "Last signal",
  start: "Start",
  end: "Finish",
  name_local: "Local name",
  itinerary: "Day by day",
};

// Is this fact one whose only source is weak? An itinerary note covers every day.
export function isWeak(t: Pick<Trek, "weak_sources">, field: string): boolean {
  const fields = (t.weak_sources ?? []).map((w) => w.field);
  return fields.includes(field) || (field.startsWith("itinerary.day") && fields.includes("itinerary"));
}

export function weakLabel(field: string): string {
  const day = /^itinerary\.day(\d+)$/.exec(field);
  return day ? `Day ${day[1]}` : (LABELS[field] ?? field);
}
