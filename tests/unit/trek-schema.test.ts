import { describe, expect, it } from "vitest";
import { readTrekFiles, validateTrekDocument } from "@/lib/trek-files";
import { sampleTrek } from "./sample-trek";

const check = (t: unknown, file = "example-trek.yaml") => validateTrekDocument(file, t).errors;

describe("trek schema", () => {
  it("accepts a well-formed, sourced trek", () => expect(check(sampleTrek())).toEqual([]));

  it("rejects a fact no source supports", () => {
    const t = sampleTrek();
    t.sources[0]!.supports = t.sources[0]!.supports.filter((s) => s !== "highest_point");
    expect(check(t).join()).toMatch(/highest_point has a value but no source/);
  });

  it("allows an unknown fact as null without a source", () => {
    const t = sampleTrek();
    t.distance_km = null;
    t.sources[0]!.supports = t.sources[0]!.supports.filter((s) => s !== "distance_km");
    expect(check(t)).toEqual([]);
  });

  it("rejects a camp above the highest point", () => {
    const t = sampleTrek();
    t.itinerary[0]!.camp_altitude_m = 3500;
    expect(check(t).join()).toMatch(/above highest_point/);
  });

  it("accepts a weak-source note on a fact that has a value", () => {
    const t = sampleTrek();
    t.weak_sources = [
      { field: "distance_km", note: "Only one travel-guide passage gives this figure." },
      { field: "itinerary.day2", note: "The summit-day stage comes from an uncited list." },
    ];
    expect(check(t)).toEqual([]);
  });

  it("rejects a weak-source note on a null fact, an unknown field or a missing day, and duplicates", () => {
    const t = sampleTrek();
    t.permits = null;
    t.weak_sources = [
      { field: "permits", note: "x" },
      { field: "difficulty", note: "x" },
      { field: "itinerary.day3", note: "x" },
      { field: "days", note: "x" },
      { field: "days", note: "y" },
    ];
    const errors = check(t).join("\n");
    expect(errors).toMatch(/weak_sources points at permits, which is null/);
    expect(errors).toMatch(/weak_sources points at difficulty, which is null or not a sourced fact/);
    expect(errors).toMatch(/weak_sources points at itinerary.day3/);
    expect(errors).toMatch(/weak_sources lists days twice/);
  });

  it("rejects a file whose slug doesn't match its name", () => expect(check(sampleTrek(), "other.yaml").join()).toMatch(/does not match/));

  it("rejects unknown keys and http sources", () => {
    expect(check({ ...sampleTrek(), altitude: 1 }).length).toBeGreaterThan(0);
    const t = sampleTrek();
    t.sources[0]!.url = "http://example.org";
    expect(check(t).length).toBeGreaterThan(0);
  });

  it("requires the budget to be labelled as our estimate", () => {
    const t = sampleTrek();
    t.budget_inr.basis = "Costs about this much";
    expect(check(t).length).toBeGreaterThan(0);
  });

  it("caps an audio script at 90 words", () => {
    const t = sampleTrek();
    t.audio_script = Array.from({ length: 90 }, () => "word").join(" ");
    expect(check(t)).toEqual([]);
    t.audio_script += " more";
    expect(check(t).join()).toMatch(/audio_script is over 90 words/);
  });

  it("every trek in data/treks is valid", () => {
    const bad = readTrekFiles().filter((r) => r.errors.length > 0);
    expect(bad.map((r) => `${r.file}: ${r.errors.join("; ")}`)).toEqual([]);
  });
});
