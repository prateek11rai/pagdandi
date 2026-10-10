import { MONTH_NAMES } from "./format";
import { REGIONS, type Trek } from "./trek-schema";

// Search words for our own difficulty grades, so "beginners" finds easy treks.
const DIFFICULTY_WORDS: Record<Trek["difficulty"], string> = {
  easy: "easy trek, suitable for beginners and first-timers",
  moderate: "moderate trek, fine for fit beginners with some preparation",
  difficult: "difficult trek for experienced trekkers",
};

// The text we index and embed for one trek. Only data from the YAML, in plain sentences.
export function trekDocument(t: Trek): { title: string; body: string } {
  const title = [t.name, t.name_local?.text, t.state, REGIONS[t.region]].filter(Boolean).join(", ");
  const length =
    t.days === null ? null : t.days === 1 ? "A one-day hike." : `A ${t.days}-day multi-day trek.`;
  const top =
    t.highest_point.altitude_m === null
      ? `Highest point: ${t.highest_point.name}.`
      : `Highest point: ${t.highest_point.name}, ${t.highest_point.altitude_m} metres.`;
  const season =
    t.season_months.length > 0 ? `Season: ${t.season_months.map((m) => MONTH_NAMES[m - 1]).join(", ")}.` : null;
  const places = [...new Set(t.itinerary.flatMap((d) => [d.from, d.to]))];
  const route = places.length > 0 ? `Route: ${places.join(", ")}.` : null;
  const g = t.getting_there;
  const access = [
    g.road_head && `Road head: ${g.road_head}.`,
    g.railhead && `Nearest railhead: ${g.railhead.name}.`,
    g.airport && `Nearest airport: ${g.airport.name}.`,
  ].filter(Boolean);
  const body = [
    t.area,
    DIFFICULTY_WORDS[t.difficulty] + ".",
    length,
    top,
    season,
    `Starts at ${t.start.name}.`,
    route,
    ...access,
    ...t.highlights,
  ]
    .filter(Boolean)
    .join(" ");
  return { title, body };
}
