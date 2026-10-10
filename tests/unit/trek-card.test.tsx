import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TrekCard } from "@/components/trek-card";

describe("trek card", () => {
  it("renders the database values it is given, and nothing else numeric", () => {
    const html = renderToStaticMarkup(
      <TrekCard
        trek={{
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
        }}
        reason="Gentle forest trail, big views."
      />,
    );
    expect(html).toContain("3,810 m");
    expect(html).toContain("4 days");
    expect(html).toContain("Dec–Feb");
    expect(html).toContain("₹8,000–14,000");
    expect(html).toContain('href="/treks/example-trek"');
    expect(html).not.toContain("Uttarakhand · Uttarakhand");
  });
});
