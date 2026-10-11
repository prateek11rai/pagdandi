import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TrekTable } from "@/components/trek-table";
import { readTrekFiles } from "@/lib/trek-files";
import { filterRows, trekRow } from "@/lib/trek-row";

const rows = readTrekFiles().map((r) => trekRow(r.trek!, null));
const bodyRows = (html: string) => html.split("<tbody")[1]!.match(/<tr\b/g) ?? [];

describe("Treks (/treks)", () => {
  it("renders every trek as a table row, with the intro column and the count", () => {
    const html = renderToStaticMarkup(<TrekTable rows={rows} initial={{}} />);
    expect(rows).toHaveLength(20);
    expect(bodyRows(html)).toHaveLength(20);
    expect(html).toContain("Showing 20 of 20 treks");
    expect(html).toContain('placeholder="Trek name"');
    expect(html.match(/not recorded yet/g)).toHaveLength(20);
  });

  it("marks facts that rest on a weak source", () => {
    const html = renderToStaticMarkup(<TrekTable rows={rows.filter((r) => r.slug === "kedarkantha")} initial={{}} />);
    expect(html).toMatch(/>3<\/span><span[^>]*>· weak source</);
    const triund = renderToStaticMarkup(<TrekTable rows={rows.filter((r) => r.slug === "triund")} initial={{}} />);
    expect(triund).toMatch(/Apr–Oct<\/span><span[^>]*>· weak source</);
  });

  it("starts from the filters in the URL", () => {
    const html = renderToStaticMarkup(<TrekTable rows={rows} initial={{ region: "sahyadri" }} />);
    expect(bodyRows(html)).toHaveLength(2);
    expect(html).toContain("Showing 2 of 20 treks");
  });
});

describe("table filters", () => {
  const slugs = (f: Parameters<typeof filterRows>[1]) => filterRows(rows, f).map((r) => r.slug);
  it("matches the trek name as plain text, not by meaning", () => {
    expect(slugs({ q: "kedar" })).toEqual(["kedarkantha"]);
    expect(slugs({ q: "snow trek" })).toEqual([]);
  });
  it("combine like the database filters", () => {
    expect(slugs({ region: "sahyadri" }).sort()).toEqual(["harishchandragad", "kalsubai"]);
    expect(slugs({ days: "1", difficulty: "easy" })).toEqual(["nongriat-root-bridges", "triund"]);
    expect(slugs({ month: 8, region: "kashmir" })).toEqual(["kashmir-great-lakes"]);
  });
});
