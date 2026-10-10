import { describe, expect, it } from "vitest";
import { numbersWithin } from "@/lib/conditions/summarize";

describe("news summary guard", () => {
  it("accepts a rephrase that keeps the headline's numbers", () =>
    expect(numbersWithin("Road shut for 2 days after a slide", "Landslide shuts road for 2 days")).toBe(true));
  it("rejects a number the headline doesn't have", () =>
    expect(numbersWithin("Snow up to 3 feet on the pass", "Fresh snowfall on the pass")).toBe(false));
});
