export interface ForecastDay {
  date: string; // YYYY-MM-DD, IST
  tmaxC: number | null;
  tminC: number | null;
  precipMm: number | null;
  snowCm: number | null;
  windKmh: number | null;
  code: number | null; // WMO weather code
}

export interface PlaceForecast {
  place: "road_head" | "high_point";
  name: string;
  elevationM: number | null;
  days: ForecastDay[];
}

export interface ForecastPayload {
  places: PlaceForecast[];
}

export interface NewsItem {
  title: string;
  url: string;
  source: string | null;
  date: string | null; // ISO
}

export interface NewsPayload {
  query: string;
  items: NewsItem[];
  fixture?: boolean; // true when the items are recorded samples, not live search results
}

// Gemma's summary: at most three bullets, each tied to one of the items above.
export interface NewsSummary {
  bullets: { text: string; url: string; date: string | null }[];
}

export interface LatestConditions {
  forecast: { fetchedAt: Date; payload: ForecastPayload } | null;
  news: { fetchedAt: Date; payload: NewsPayload; summary: NewsSummary | null } | null;
}
