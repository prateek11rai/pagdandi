import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryBudgetStore, periodsIST, reserve } from "@/lib/budget";
import { fixtureNews, itemsFrom, normalise, replyShape, SerpApiReplyError, serpApiNews, type NewsSource, type ReplyError } from "@/lib/conditions/news";
import { newsCheck, parseNewsCheckArgs, type NewsCheckDeps } from "@/lib/conditions/news-check";
import type { Trek } from "@/lib/trek-schema";
import { readTrekFiles } from "@/lib/trek-files";

const caps = { daily: 25, monthly: 200 };
const now = new Date("2026-10-11T10:00:00Z");
const { day, month } = periodsIST(now);
const treks = readTrekFiles().map((r) => r.trek!);

// The recorded sample results stand in for SerpApi; the reservation is the digest's own. No live call.
function setup(o: { used?: { day?: number; month?: number }; fail?: Error } = {}) {
  const budget = new MemoryBudgetStore();
  if (o.used?.day) budget.counts.set(`serpapi:day:${day}`, o.used.day);
  if (o.used?.month) budget.counts.set(`serpapi:month:${month}`, o.used.month);
  const searched: string[] = [];
  const queries: (string | undefined)[] = [];
  const news: NewsSource = {
    async fetch(t, query) {
      searched.push(t.slug);
      queries.push(query);
      await reserve(budget, "serpapi", caps, now);
      if (o.fail) throw o.fail;
      return fixtureNews().fetch(t);
    },
  };
  const deps: NewsCheckDeps = {
    getTrek: async (slug) => treks.find((t) => t.slug === slug) ?? null,
    news,
    budget,
    caps,
    summarise: async (_t: Trek, items) => ({ bullets: items.slice(0, 1).map((i) => ({ text: i.title, url: i.url, date: i.date })) }),
    now,
  };
  return { deps, searched, queries };
}

describe("pnpm news:check", () => {
  it("takes exactly --trek and one slug", () => {
    expect(parseNewsCheckArgs(["--trek", "kedarkantha"])).toEqual({ slug: "kedarkantha" });
    expect(parseNewsCheckArgs(["--", "--trek", "kedarkantha"])).toEqual({ slug: "kedarkantha" });
    expect(parseNewsCheckArgs(["--trek", "kedarkantha", "--query", "Uttarakhand trek when:7d"])).toEqual({ slug: "kedarkantha", query: "Uttarakhand trek when:7d" });
    expect(parseNewsCheckArgs(["--query", "Uttarakhand trek", "--trek", "triund"])).toEqual({ slug: "triund", query: "Uttarakhand trek" });
    for (const bad of [
      [],
      ["kedarkantha"],
      ["--trek"],
      ["--trek", "kedarkantha", "triund"],
      ["--treks", "kedarkantha"],
      ["--trek", "Kedar Kantha"],
      ["--query", "Uttarakhand trek"],
      ["--trek", "kedarkantha", "--query", "x"],
      ["--trek", "kedarkantha", "--trek", "triund"],
      ["--trek", "kedarkantha", "--sweep", "yes"],
    ]) {
      expect(parseNewsCheckArgs(bad)).toHaveProperty("error");
    }
  });

  it("searches once, for the trek it was given, and counts it once", async () => {
    const { deps, searched } = setup({ used: { day: 3, month: 40 } });
    const r = await newsCheck("kedarkantha", deps);
    expect(searched).toEqual(["kedarkantha"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.trek.name).toBe("Kedarkantha");
    expect(r.news.items.length).toBeGreaterThan(0);
    expect(r.summary?.bullets).toHaveLength(1);
    expect(r.usage).toEqual({ day: 4, month: 41 });
  });

  it("passes a diagnostic query to the same client, still once and still counted", async () => {
    const { deps, searched, queries } = setup();
    const r = await newsCheck("kedarkantha", deps, "Uttarakhand trek when:7d");
    expect(searched).toEqual(["kedarkantha"]);
    expect(queries).toEqual(["Uttarakhand trek when:7d"]);
    expect(r).toMatchObject({ ok: true, usage: { day: 1, month: 1 } });
  });

  it("refuses an unknown trek without searching", async () => {
    const { deps, searched } = setup();
    const r = await newsCheck("everest-base-camp", deps);
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/No trek called "everest-base-camp"/) });
    expect(searched).toEqual([]);
  });

  it("refuses without searching when today's cap is reached", async () => {
    const { deps, searched } = setup({ used: { day: 25, month: 60 } });
    const r = await newsCheck("kedarkantha", deps);
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/Today's SerpApi cap is reached \(25 of 25\)/), usage: { day: 25, month: 60 } });
    expect(searched).toEqual([]);
  });

  it("refuses without searching when this month's cap is reached", async () => {
    const { deps, searched } = setup({ used: { day: 0, month: 200 } });
    const r = await newsCheck("kedarkantha", deps);
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/This month's SerpApi cap is reached \(200 of 200\)/) });
    expect(searched).toEqual([]);
  });

  it("reports a failed search and doesn't retry it", async () => {
    const { deps, searched } = setup({ fail: new Error("SerpApi returned HTTP 503") });
    const r = await newsCheck("kedarkantha", deps);
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/HTTP 503\); not retrying/), usage: { day: 1, month: 1 } });
    expect(searched).toEqual(["kedarkantha"]);
  });

  it("still shows the headlines when the summary fails", async () => {
    const { deps } = setup();
    const r = await newsCheck("kedarkantha", { ...deps, summarise: async () => Promise.reject(new Error("model offline")) });
    expect(r).toMatchObject({ ok: true, summary: null, summaryError: "model offline" });
  });
});

// Reply bodies shaped like SerpApi's. The no-results wordings are the ones SerpApi documents; the digest records the
// exact wording of each live one in .data/serpapi-reply-errors.jsonl, so this test can be matched to it.
const NO_RESULTS_WORDINGS = ["Google hasn't returned any results for this query.", "Google News hasn't returned any results for this query."];
const item = (n: number, date: string) => ({ title: `Headline ${n}`, link: `https://news.example/${n}`, source: { name: "Paper" }, iso_date: date });

describe("SerpApi replies", () => {
  it("is no news when news_results is empty, absent, or absent with the no-results error", () => {
    expect(normalise([])).toEqual([]);
    expect(itemsFrom({ search_metadata: { status: "Success" }, news_results: [] })).toEqual([]);
    expect(itemsFrom({ search_metadata: { status: "Success" } })).toEqual([]);
    for (const error of NO_RESULTS_WORDINGS) {
      const seen: ReplyError[] = [];
      expect(itemsFrom({ search_metadata: { status: "Success" }, error }, (r) => seen.push(r))).toEqual([]);
      expect(seen).toEqual([{ kind: "no-results", error }]);
    }
    expect(replyShape({ search_metadata: { status: "Success" }, error: NO_RESULTS_WORDINGS[1] })).toEqual({
      keys: ["search_metadata", "error"],
      error: NO_RESULTS_WORDINGS[1],
      status: "Success",
      newsResults: null,
      topNews: null,
    });
  });

  it("treats any other error string as a failed check, never as no news", () => {
    const seen: ReplyError[] = [];
    const reply = { search_metadata: { status: "Error" }, error: "Your account has run out of searches." };
    expect(() => itemsFrom(reply, (r) => seen.push(r))).toThrow(SerpApiReplyError);
    expect(() => itemsFrom(reply)).toThrow(/^SerpApi reply error$/);
    expect(seen).toEqual([{ kind: "error", error: "Your account has run out of searches." }]);
  });

  it("reads top_news as well as news_results, once per link, newest first", () => {
    const items = itemsFrom({ news_results: [item(1, "2026-10-09T00:00:00Z"), item(2, "2026-10-07T00:00:00Z")], top_news: [item(3, "2026-10-10T00:00:00Z"), item(1, "2026-10-09T00:00:00Z")] });
    expect(items.map((i) => i.title)).toEqual(["Headline 3", "Headline 1", "Headline 2"]);
  });
});

describe("SerpApi client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("counts an error reply once and throws, without retrying", async () => {
    const budget = new MemoryBudgetStore();
    let calls = 0;
    vi.stubGlobal("fetch", async () => (calls++, new Response(JSON.stringify({ error: "Invalid parameter." }))));
    const client = serpApiNews({ apiKey: "test-key", budget, caps, onReplyError: () => {} });
    await expect(client.fetch(treks[0]!)).rejects.toThrow(SerpApiReplyError);
    expect(calls).toBe(1);
    expect(budget.counts.get(`serpapi:day:${periodsIST(new Date()).day}`)).toBe(1);
  });
});
