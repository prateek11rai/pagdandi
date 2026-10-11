import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CHIPS, NewPlan } from "@/components/new-plan";
import { pickFeatured } from "@/lib/featured";
import { card } from "./sample-card";

const featured = [
  card({ slug: "kedarkantha", name: "Kedarkantha" }),
  card({ slug: "kalsubai", name: "Kalsubai", region: "sahyadri", state: "Maharashtra" }),
  card({ slug: "sandakphu", name: "Sandakphu", region: "sikkim-darjeeling", state: "West Bengal" }),
];

describe("New plan (/)", () => {
  const html = renderToStaticMarkup(<NewPlan featured={featured} total={20} />);

  it("opens with the question, the composer and three suggestion chips", () => {
    expect(html).toContain("Which trek can your group actually do?");
    expect(html.match(/<textarea/g)).toHaveLength(1);
    expect(html).toContain("Tell the guide about your group: how many of you");
    expect(html).toContain("Answers come from 20 sourced Indian treks.");
    for (const c of CHIPS) expect(html).toContain(`>${c.replace("&", "&amp;")}</button>`);
    expect(CHIPS).toHaveLength(3);
  });

  it("has no trek filters, and links three treks plus the full list", () => {
    expect(html).not.toContain("<select");
    expect(html).not.toMatch(/Region|Difficulty/);
    expect(html.match(/href="\/treks\/[a-z-]+"/g)).toHaveLength(3);
    expect(html).toContain('href="/treks"');
  });
});

describe("featured treks", () => {
  it("prefer treks with audio, one per region", () => {
    const all = [
      card({ slug: "kedarkantha", region: "uttarakhand" }),
      card({ slug: "nag-tibba", region: "uttarakhand", audioUrl: "/audio/nag-tibba.en.mp3" }),
      card({ slug: "kalsubai", region: "sahyadri" }),
      card({ slug: "sandakphu", region: "sikkim-darjeeling" }),
      card({ slug: "kudremukh", region: "western-ghats-south", audioUrl: "/audio/kudremukh.en.mp3" }),
    ];
    expect(pickFeatured(all).map((c) => c.slug)).toEqual(["kudremukh", "nag-tibba", "kalsubai"]);
    expect(pickFeatured(all.map((c) => ({ ...c, audioUrl: null }))).map((c) => c.slug)).toEqual(["kedarkantha", "kalsubai", "sandakphu"]);
  });
});
