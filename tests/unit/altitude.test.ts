import { describe, expect, it } from "vitest";
import { altitudeNote, altitudeSeries, profileSegments } from "@/lib/altitude";
import { sampleTrek } from "./sample-trek";

describe("altitude figure", () => {
  it("draws a day hike up to the summit and back, not flat", () => {
    const t = sampleTrek();
    t.days = 1;
    t.itinerary = [{ day: 1, from: "Base", to: "Base", camp_altitude_m: null, max_altitude_m: 3200, distance_km: 8 }];
    const segs = profileSegments(altitudeSeries(t));
    expect(segs).toHaveLength(1);
    expect(segs[0]!.map((p) => p.altitude)).toEqual([2000, 3200, 2000]);
    expect(altitudeNote(altitudeSeries(t))).toBeNull();
  });

  it("draws nothing and says so when the stages aren't sourced", () => {
    const t = sampleTrek();
    t.days = 3;
    t.itinerary = [];
    const s = altitudeSeries(t);
    expect(profileSegments(s)).toEqual([]);
    expect(altitudeNote(s)).toBe("Camp altitudes not known: our sources don't give the daily stages.");
    expect(s.highs).toHaveLength(1);
    // A loop (start = end) shows only the start and the summit.
    expect(s.line.filter(Boolean).map((p) => p!.label)).toEqual(["Base"]);
  });

  it("keeps the finish when a trek with unknown stages ends somewhere else", () => {
    const t = sampleTrek();
    t.days = 3;
    t.itinerary = [];
    t.end = { ...t.end, name: "Other village", altitude_m: 1800 };
    expect(altitudeSeries(t).line.filter(Boolean).map((p) => p!.label)).toEqual(["Base", "Other village"]);
  });

  it("never draws across an unknown camp, and lists those days", () => {
    const t = sampleTrek();
    t.days = 3;
    t.itinerary = [
      { day: 1, from: "Base", to: "A", camp_altitude_m: null, max_altitude_m: null, distance_km: null },
      { day: 2, from: "A", to: "B", camp_altitude_m: 2900, max_altitude_m: null, distance_km: null },
      { day: 3, from: "B", to: "Base", camp_altitude_m: null, max_altitude_m: null, distance_km: null },
    ];
    const s = altitudeSeries(t);
    expect(profileSegments(s).map((seg) => seg.map((p) => p.day))).toEqual([[2, 3]]);
    expect(altitudeNote(s)).toBe("Camp altitude not known for day 1.");
  });
});
