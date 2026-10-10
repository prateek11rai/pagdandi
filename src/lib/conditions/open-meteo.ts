import type { Trek } from "../trek-schema";
import type { ForecastDay, ForecastPayload, PlaceForecast } from "./types";

const API = "https://api.open-meteo.com/v1/forecast";
const DAILY = "temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,wind_speed_10m_max,weather_code";

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
  const d = ((await res.json()) as { daily: Record<string, (number | null)[] | string[]> }).daily;
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

// Road head at its own coordinates; the high point at the road head's coordinates with its altitude,
// so Open-Meteo corrects temperatures for height. We don't have reliable coordinates for every summit.
export async function fetchForecast(t: Trek): Promise<ForecastPayload> {
  const places: PlaceForecast[] = [
    { place: "road_head", name: t.start.name, elevationM: t.start.altitude_m, days: await forecastAt(t.start.lat, t.start.lon, t.start.altitude_m) },
  ];
  const top = t.highest_point.altitude_m;
  if (top !== null && top - (t.start.altitude_m ?? 0) > 300) {
    places.push({ place: "high_point", name: t.highest_point.name, elevationM: top, days: await forecastAt(t.start.lat, t.start.lon, top) });
  }
  return { places };
}
