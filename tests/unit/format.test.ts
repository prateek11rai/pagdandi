import { describe, expect, it } from "vitest";
import { formatAltitude, formatBudget, formatBudgetShort, formatDays, formatDaysShort, formatSeason } from "@/lib/format";

describe("formatSeason", () => {
  it("wraps across the new year", () => expect(formatSeason([12, 1, 2, 3, 4])).toBe("Dec–Apr"));
  it("splits separate windows", () => expect(formatSeason([4, 5, 6, 9, 10, 11])).toBe("Apr–Jun, Sep–Nov"));
  it("handles one month", () => expect(formatSeason([10])).toBe("Oct"));
  it("says all year", () => expect(formatSeason([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe("All year"));
  it("says not known for none", () => expect(formatSeason([])).toBe("Not known yet"));
});

describe("facts", () => {
  it("formats altitude in Indian grouping, or not known", () => {
    expect(formatAltitude(3810)).toBe("3,810 m");
    expect(formatAltitude(null)).toBe("Not known yet");
  });
  it("calls one day a day hike", () => {
    expect(formatDays(1)).toBe("Day hike");
    expect(formatDays(6)).toBe("6 days");
  });
  it("formats a budget range", () => expect(formatBudget(8000, 14000)).toBe("₹8,000–14,000"));
  it("shortens days and budgets for cards", () => {
    expect([formatDaysShort(1), formatDaysShort(3), formatDaysShort(null)]).toEqual(["Day hike", "3", "Not known yet"]);
    expect([formatBudgetShort(6000, 12000), formatBudgetShort(500, 1500), formatBudgetShort(2000, 2000)]).toEqual(["₹6–12k", "₹500–1.5k", "₹2k"]);
  });
});
