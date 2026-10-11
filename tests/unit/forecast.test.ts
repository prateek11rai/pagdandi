import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureForecast } from "@/lib/conditions/open-meteo";
import { sampleTrek } from "./sample-trek";

afterEach(() => vi.unstubAllGlobals());

describe("forecast fixtures", () => {
  it("serve the recorded sample, flagged as such and dated from today in IST, without the network", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("fixture mode must not call the network")));
    const f = await fixtureForecast(() => new Date("2026-12-31T20:00:00Z")).fetch(sampleTrek()); // 01:30 IST, 1 Jan
    expect(f.fixture).toBe(true);
    expect(f.places.map((p) => [p.place, p.name, p.elevationM])).toEqual([
      ["road_head", "Base", 2000],
      ["high_point", "Example Top", 3200],
    ]);
    expect(f.places[0]!.days.map((d) => d.date)).toEqual(["2027-01-01", "2027-01-02", "2027-01-03", "2027-01-04"]);
    expect(f.places[1]!.days[0]).toMatchObject({ tminC: -8.6, snowCm: 2.03, code: 86 });
  });

  it("follow the live rule for the high point: only when it's more than 300 m above the road head", async () => {
    const t = sampleTrek();
    t.highest_point.altitude_m = 2200;
    const f = await fixtureForecast().fetch(t);
    expect(f.places.map((p) => p.place)).toEqual(["road_head"]);
  });
});
