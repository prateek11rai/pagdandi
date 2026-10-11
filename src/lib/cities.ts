// Approximate city-centre coordinates, used only to order search results by distance from the
// group's starting city. Never shown to users.
const CITIES: Record<string, [number, number]> = {
  delhi: [28.61, 77.21],
  mumbai: [19.08, 72.88],
  bengaluru: [12.97, 77.59],
  kolkata: [22.57, 88.36],
  chennai: [13.08, 80.27],
  hyderabad: [17.39, 78.49],
  pune: [18.52, 73.86],
  ahmedabad: [23.02, 72.57],
  jaipur: [26.91, 75.79],
  chandigarh: [30.73, 76.78],
  lucknow: [26.85, 80.95],
  dehradun: [30.32, 78.03],
  guwahati: [26.14, 91.74],
  kochi: [9.93, 76.27],
  thiruvananthapuram: [8.52, 76.94],
  bhopal: [23.26, 77.41],
};

const ALIASES: Record<string, string> = {
  "new delhi": "delhi",
  ncr: "delhi",
  "delhi ncr": "delhi",
  gurgaon: "delhi",
  gurugram: "delhi",
  noida: "delhi",
  faridabad: "delhi",
  ghaziabad: "delhi",
  bombay: "mumbai",
  "navi mumbai": "mumbai",
  thane: "mumbai",
  bangalore: "bengaluru",
  calcutta: "kolkata",
  madras: "chennai",
  cochin: "kochi",
  trivandrum: "thiruvananthapuram",
};

export function cityCoords(name: string | undefined): [number, number] | null {
  if (!name) return null;
  const key = name.trim().toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ");
  return CITIES[ALIASES[key] ?? key] ?? null;
}

// The last city the group names in their own words ("…from Delhi", "Delhi se"), if we know it.
export function cityIn(text: string): [number, number] | null {
  let found: [number, number] | null = null;
  for (const word of text.toLowerCase().match(/[a-z]+/g) ?? []) found = cityCoords(word) ?? found;
  return found;
}

export function distanceKm([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

// Keep the search's relevance order, but let distance count: every 250 km away costs one place.
export function rankByOrigin<T extends { start: [number, number] }>(items: T[], origin: [number, number] | null): T[] {
  if (!origin) return items;
  return items
    .map((it, i) => ({ it, score: i + distanceKm(origin, it.start) / 250 }))
    .sort((a, b) => a.score - b.score)
    .map((x) => x.it);
}
