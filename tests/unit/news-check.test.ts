import { describe, expect, it } from "vitest";
import { MemoryBudgetStore, periodsIST, reserve } from "@/lib/budget";
import { fixtureNews, type NewsSource } from "@/lib/conditions/news";
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
  const news: NewsSource = {
    async fetch(t) {
      searched.push(t.slug);
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
  return { deps, searched };
}

describe("pnpm news:check", () => {
  it("takes exactly --trek and one slug", () => {
    expect(parseNewsCheckArgs(["--trek", "kedarkantha"])).toEqual({ slug: "kedarkantha" });
    expect(parseNewsCheckArgs(["--", "--trek", "kedarkantha"])).toEqual({ slug: "kedarkantha" });
    for (const bad of [[], ["kedarkantha"], ["--trek"], ["--trek", "kedarkantha", "triund"], ["--treks", "kedarkantha"], ["--trek", "Kedar Kantha"]]) {
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
