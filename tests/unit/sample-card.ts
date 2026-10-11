import type { TrekCard } from "@/lib/treks";

// A synthetic trek card for tests. Not real data.
export const card = (over: Partial<TrekCard> = {}): TrekCard => ({
  slug: "example-trek",
  name: "Example Trek",
  state: "Uttarakhand",
  region: "uttarakhand",
  difficulty: "moderate",
  days: 4,
  highestAltitudeM: 3810,
  seasonMonths: [12, 1, 2],
  budgetMinInr: 8000,
  budgetMaxInr: 14000,
  audioUrl: null,
  start: [30.1, 78.1],
  ...over,
});
