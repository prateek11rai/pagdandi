import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TrekCard } from "@/components/trek-card";
import { card } from "./sample-card";

describe("trek card", () => {
  it("renders the database values it is given, and nothing else numeric", () => {
    const html = renderToStaticMarkup(<TrekCard trek={card()} />);
    expect(html).toContain("3,810 m");
    expect(html).toContain(">4<");
    expect(html).toContain("Dec–Feb");
    expect(html).toContain('href="/treks/example-trek"');
    expect(html).not.toContain("Uttarakhand · Uttarakhand");
    expect(html).not.toContain("target=");
  });

  it("shows the budget and the guide's reason in the chat, and opens in a new tab", () => {
    const html = renderToStaticMarkup(<TrekCard trek={card()} third="budget" reason="Gentle forest trail, big views." newTab />);
    expect(html).toContain("₹8–14k");
    expect(html).not.toContain("Dec–Feb");
    expect(html).toContain("Gentle forest trail, big views.");
    expect(html).toContain('target="_blank"');
  });
});
