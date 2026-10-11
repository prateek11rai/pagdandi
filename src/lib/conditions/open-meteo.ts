import { readFileSync } from "node:fs";
import path from "node:path";
import { addDays, todayIST } from "../dates";
import type { Trek } from "../trek-schema";
import type { ForecastDay, ForecastPayload, PlaceForecast } from "./types";

export interface ForecastSource {
  fetch(t: Trek): Promise<ForecastPayload>;
}

type Place = PlaceForecast["place"];
type DailyBlock = Record<string, (number | null)[] | string[]>;

const API = "https://api.open-meteo.com/v1/forecast";
const DAILY = "temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,wind_speed_10m_max,weather_code";

export function parseDaily(d: DailyBlock): ForecastDay[] {
  return (d.time as string[]).map((date, i) => ({
    date,
    tmaxC: (d.temperature_2m_max as (number | null)[])[i] ?? null,
    tminC: (d.temperature_2m_min as (number | null)[])[i] ?? null,
    precipMm: (d.precipitation_sum as (number | null)[])[i] ?? null,
    snowCm: (d.snowfall_sum as (number | null)[])[i] ?? null,
    windKmh: (d.wind_speed_10m_max as (number | null)[])[i] ?? null,
    code: (d.weather_code as (number | null)[])[i] ?? null,
  }));
}

async function forecastAt(lat: number, lon: number, elevation: number | null): Promise<ForecastDay[]> {
  const url = new URL(API);
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lon.toFixed(4));
  if (elevation !== null) url.searchParams.set("elevation", String(elevation));
  url.searchParams.set("daily", DAILY);
  url.searchParams.set("timezone", "Asia/Kolkata");
  url.searchParams.set("forecast_days", "4");
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Open-Meteo returned HTTP ${res.status}`);
  return parseDaily(((await res.json()) as { daily: DailyBlock }).daily);
}

// Road head at its own coordinates; the high point at the road head's coordinates with its altitude,
// so Open-Meteo corrects temperatures for height. We don't have reliable coordinates for every summit.
async function placesFor(t: Trek, daysAt: (place: Place, elevation: number | null) => Promise<ForecastDay[]>): Promise<PlaceForecast[]> {
  const places: PlaceForecast[] = [
    { place: "road_head", name: t.start.name, elevationM: t.start.altitude_m, days: await daysAt("road_head", t.start.altitude_m) },
  ];
  const top = t.highest_point.altitude_m;
  if (top !== null && top - (t.start.altitude_m ?? 0) > 300) {
    places.push({ place: "high_point", name: t.highest_point.name, elevationM: top, days: await daysAt("high_point", top) });
  }
  return places;
}

export function openMeteoForecast(): ForecastSource {
  return {
    async fetch(t) {
      return { places: await placesFor(t, (_place, elevation) => forecastAt(t.start.lat, t.start.lon, elevation)) };
    },
  };
}

// Recorded sample forecasts for CI and tests, clearly marked as fixtures. Every trek gets the same days, dated from today.
export function fixtureForecast(now: () => Date = () => new Date()): ForecastSource {
  return {
    async fetch(t) {
      const file = path.join(process.cwd(), "src", "lib", "conditions", "fixtures", "open-meteo-sample.json");
      const sample = JSON.parse(readFileSync(file, "utf8")) as Record<Place, { daily: DailyBlock }>;
      const today = todayIST(now());
      const daysAt = async (place: Place) => parseDaily(sample[place].daily).map((d, i) => ({ ...d, date: addDays(today, i) }));
      return { places: await placesFor(t, daysAt), fixture: true };
    },
  };
}
