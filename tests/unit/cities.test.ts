import { describe, expect, it } from "vitest";
import { cityCoords, cityIn, distanceKm, rankByOrigin } from "@/lib/cities";

describe("starting city", () => {
  it("knows common names and aliases", () => {
    expect(cityCoords("Delhi")).not.toBeNull();
    expect(cityCoords("Gurgaon")).toEqual(cityCoords("delhi"));
    expect(cityCoords("Bangalore")).toEqual(cityCoords("Bengaluru"));
    expect(cityCoords("Atlantis")).toBeNull();
  });

  it("measures straight-line distance", () => {
    expect(Math.round(distanceKm(cityCoords("delhi")!, cityCoords("mumbai")!) / 10) * 10).toBe(1150);
  });

  it("puts a nearby fit ahead of a far one with similar relevance", () => {
    const far = { slug: "kudremukh", start: [13.23, 75.25] as [number, number] };
    const near = { slug: "dayara-bugyal", start: [30.86, 78.53] as [number, number] };
    expect(rankByOrigin([far, near], cityCoords("Delhi")).map((t) => t.slug)).toEqual(["dayara-bugyal", "kudremukh"]);
  });

  it("leaves the order alone without a known city", () => {
    const a = { slug: "a", start: [10, 76] as [number, number] };
    const b = { slug: "b", start: [30, 78] as [number, number] };
    expect(rankByOrigin([a, b], null).map((t) => t.slug)).toEqual(["a", "b"]);
  });
});

describe("the group's own city", () => {
  it("is the last known city or alias in what they wrote", () => {
    expect(cityIn("hum 4 log hain, December mein Delhi se")).toEqual(cityCoords("delhi"));
    expect(cityIn("we're in Bombay now, not Bangalore any more... actually Bangalore")).toEqual(cityCoords("bengaluru"));
    expect(cityIn("a trek with lakes")).toBeNull();
  });
});
