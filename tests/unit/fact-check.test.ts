import { describe, expect, it } from "vitest";
import { checkSentence, REPLACEMENT, SentenceBuffer, userNumbersFrom, type FactContext } from "@/lib/fact-check";

const ctx: FactContext = {
  treks: [
    {
      slug: "kedarkantha",
      names: ["kedarkantha"],
      altitudesM: [3810, 1920],
      days: [4],
      distancesKm: [20],
      budget: { min: 8000, max: 14000 },
    },
    {
      slug: "triund",
      names: ["triund"],
      altitudesM: [2875],
      days: [1],
      distancesKm: [9, 18],
      budget: { min: 1500, max: 5000 },
    },
  ],
  contextSlugs: ["kedarkantha"],
  userNumbers: userNumbersFrom("5 of us, 2 first-timers, ₹12k each, 4 days in December"),
};

describe("prose fact-check", () => {
  it("keeps numbers that match the database", () => {
    const r = checkSentence("Kedarkantha tops out at 3,810 m over 4 days.", ctx);
    expect(r).toEqual({ text: "Kedarkantha tops out at 3,810 m over 4 days.", replaced: 0 });
  });

  it("replaces a wrong altitude", () => {
    const r = checkSentence("Kedarkantha reaches 4,200 m.", ctx);
    expect(r.text).toBe(`Kedarkantha reaches ${REPLACEMENT}.`);
    expect(r.replaced).toBe(1);
  });

  it("checks against the trek the sentence names, not any trek", () => {
    expect(checkSentence("Triund reaches 3,810 m.", ctx).replaced).toBe(1);
    expect(checkSentence("Triund reaches 2,875 metres.", ctx).replaced).toBe(0);
  });

  it("converts feet before comparing", () => {
    expect(checkSentence("Kedarkantha is about 12,500 ft high.", ctx).replaced).toBe(0);
    expect(checkSentence("Kedarkantha is about 15,000 feet high.", ctx).replaced).toBe(1);
  });

  it("allows the user's own numbers back", () => {
    expect(checkSentence("That fits your ₹12k budget for 4 days.", ctx).replaced).toBe(0);
  });

  it("checks costs against the budget band", () => {
    expect(checkSentence("Kedarkantha costs about ₹10,000.", ctx).replaced).toBe(0);
    expect(checkSentence("Kedarkantha costs about ₹40,000.", ctx).replaced).toBe(1);
  });

  it("uses the turn's treks when no trek is named", () => {
    expect(checkSentence("The trail is 20 km in total.", ctx).replaced).toBe(0);
    expect(checkSentence("The trail is 35 km in total.", ctx).replaced).toBe(1);
  });

  it("lets the safety threshold through", () => {
    expect(checkSentence("Above 3,500 m, go slowly.", ctx).replaced).toBe(0);
  });

  it("judges each number once, even when two patterns match it", () => {
    // "₹10,000 rupees" matches both cost patterns; the first verdict stands and nothing is doubled.
    expect(checkSentence("Kedarkantha costs ₹10,000 rupees.", ctx)).toEqual({ text: "Kedarkantha costs ₹10,000 rupees.", replaced: 0 });
    expect(checkSentence("Kedarkantha costs ₹90,000 rupees.", ctx).replaced).toBe(1);
  });

  it("ignores numbers without units", () => {
    expect(checkSentence("Day 2 is the summit push for 5 friends.", ctx).replaced).toBe(0);
  });
});

describe("sentence buffer", () => {
  it("releases whole sentences only", () => {
    const b = new SentenceBuffer();
    expect(b.push("Kedarkantha is 3,8")).toEqual([]);
    expect(b.push("10 m high. It takes")).toEqual(["Kedarkantha is 3,810 m high."]);
    expect(b.flush()).toBe(" It takes");
  });

  it("does not split decimals", () => {
    const b = new SentenceBuffer();
    expect(b.push("About 4.5 km. Then")).toEqual(["About 4.5 km."]);
  });
});
