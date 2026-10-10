// WMO weather interpretation codes, as used by Open-Meteo.
const LABELS: [number[], string][] = [
  [[0], "Clear"],
  [[1, 2], "Partly cloudy"],
  [[3], "Overcast"],
  [[45, 48], "Fog"],
  [[51, 53, 55, 56, 57], "Drizzle"],
  [[61, 63, 80, 81], "Rain"],
  [[65, 82], "Heavy rain"],
  [[66, 67], "Freezing rain"],
  [[71, 73, 77, 85], "Snow"],
  [[75, 86], "Heavy snow"],
  [[95], "Thunderstorm"],
  [[96, 99], "Thunderstorm, hail"],
];

export function weatherLabel(code: number | null): string {
  if (code === null) return "–";
  return LABELS.find(([codes]) => codes.includes(code))?.[1] ?? "–";
}

export function isSevere(code: number | null): boolean {
  return code !== null && [65, 67, 75, 82, 86, 95, 96, 99].includes(code);
}
