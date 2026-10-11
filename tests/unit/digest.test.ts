import { describe, expect, it } from "vitest";
import { exitCode, runDigest, type DigestDeps } from "@/jobs/digest-core";
import { BudgetExceededError } from "@/lib/budget";
import type { ForecastPayload } from "@/lib/conditions/types";
import { MemorySubscriptionStore } from "@/lib/subscriptions";
import type { Trek } from "@/lib/trek-schema";
import { sampleTrek } from "./sample-trek";

const NOW = new Date("2026-10-11T01:30:00Z"); // 07:00 IST
const forecast: ForecastPayload = {
  places: [{ place: "road_head", name: "Base", elevationM: 2000, days: [{ date: "2026-10-11", tmaxC: 15, tminC: 3, precipMm: 0, snowCm: 0, windKmh: 10, code: 75 }] }],
};

async function setup(subs: { slug: string; travelDate: string }[]) {
  const store = new MemorySubscriptionStore(() => NOW);
  for (const [i, s] of subs.entries()) {
    await store.insertPending({ email: "admin@example.com", slug: s.slug, travelDate: s.travelDate, confirmHash: Buffer.from([i]), unsubscribeHash: Buffer.from([100 + i]) });
    await store.activateByConfirmHash(Buffer.from([i]));
  }
  const calls = { forecast: [] as string[], news: [] as string[] };
  const sent: { subject: string; text: string }[] = [];
  const treks: Record<string, Trek> = { a: sampleTrek("a", "Trek A"), b: sampleTrek("b", "Trek B"), c: sampleTrek("c", "Trek C") };
  const deps: DigestDeps = {
    now: NOW,
    siteUrl: "https://example.org",
    store,
    mailer: { send: async (m) => void sent.push(m) },
    getTrek: async (s) => treks[s] ?? null,
    allSlugs: async () => Object.keys(treks),
    fetchForecast: async (t) => (calls.forecast.push(t.slug), forecast),
    fetchNews: async (t) => (calls.news.push(t.slug), { query: "q", items: [] }),
    previousNewsUrls: async () => new Set(),
    summarise: async () => ({ bullets: [] }),
    saveConditions: async () => {},
  };
  return { store, calls, sent, deps };
}

describe("daily digest", () => {
  it("fetches conditions once per trek, however many subscribers", async () => {
    const { calls, sent, deps } = await setup([
      { slug: "a", travelDate: "2026-10-20" },
      { slug: "a", travelDate: "2026-11-02" },
      { slug: "b", travelDate: "2026-10-12" },
    ]);
    const r = await runDigest(deps, { sweep: false });
    expect(calls.forecast.sort()).toEqual(["a", "b"]);
    expect(calls.news.sort()).toEqual(["a", "b"]);
    expect(r.emailsSent).toBe(3);
    expect(sent.map((m) => m.subject)).toContain("Trek B · 1 day to go · Heavy snow in the forecast");
  });

  it("sends each subscriber at most one email a day", async () => {
    const { sent, deps } = await setup([{ slug: "a", travelDate: "2026-10-20" }]);
    await runDigest(deps, { sweep: false });
    await runDigest(deps, { sweep: false });
    expect(sent).toHaveLength(1);
  });

  it("says so in the email when the search budget is used up, and reports it", async () => {
    const { sent, deps } = await setup([{ slug: "a", travelDate: "2026-10-20" }]);
    deps.fetchNews = async () => {
      throw new BudgetExceededError("serpapi", "month", 200);
    };
    const r = await runDigest(deps, { sweep: false });
    expect(r.budgetExceeded).toBe(true);
    expect(exitCode(r)).toBe(1);
    expect(sent[0]!.text).toContain("search budget is used up");
  });

  it("keeps going when one trek's forecast fails, says so in that email, and still succeeds", async () => {
    const { sent, deps } = await setup([
      { slug: "a", travelDate: "2026-10-20" },
      { slug: "b", travelDate: "2026-10-12" },
    ]);
    deps.fetchForecast = async (t) => {
      if (t.slug === "a") throw new TypeError("fetch failed", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });
      return forecast;
    };
    const r = await runDigest(deps, { sweep: false });
    expect(r.forecastFailures).toEqual([{ slug: "a", reason: "fetch failed (UND_ERR_CONNECT_TIMEOUT)" }]);
    expect(r.errors).toEqual([]);
    expect(exitCode(r)).toBe(0);
    expect(r.emailsSent).toBe(2);
    const a = sent.find((m) => m.subject.startsWith("Trek A"))!;
    expect(a.subject).toBe("Trek A · 9 days to go · forecast unavailable");
    expect(a.text).toContain("Forecast unavailable today.");
    expect(sent.find((m) => m.subject.startsWith("Trek B"))!.subject).toBe("Trek B · 1 day to go · Heavy snow in the forecast");
  });

  it("still fails the run when an email can't be sent", async () => {
    const { deps } = await setup([{ slug: "a", travelDate: "2026-10-20" }]);
    deps.mailer = { send: async () => Promise.reject(new Error("mail service down")) };
    const r = await runDigest(deps, { sweep: false });
    expect(r.errors).toEqual(["email for a failed: mail service down"]);
    expect(exitCode(r)).toBe(1);
  });

  it("labels a sample forecast in the subject and body, and never stores it", async () => {
    const { sent, deps } = await setup([{ slug: "a", travelDate: "2026-10-20" }]);
    const saved: string[] = [];
    deps.fetchForecast = async () => ({ ...forecast, fixture: true });
    deps.saveConditions = async (_slug, kind) => void saved.push(kind);
    await runDigest(deps, { sweep: false });
    expect(saved).toEqual(["news"]);
    expect(sent[0]!.subject).toBe("Trek A · 9 days to go · Heavy snow in the forecast · SAMPLE DATA");
    expect(sent[0]!.text).toContain("FORECAST\n[SAMPLE DATA for development: this is not a real forecast]");
    expect(sent[0]!.text).toContain("Forecast: sample data recorded from Open-Meteo.com.");
    expect(sent[0]!.text).not.toContain("Weather data by Open-Meteo.com.");
  });

  it("includes one thing to do outside and an unsubscribe link", async () => {
    const { sent, deps } = await setup([{ slug: "a", travelDate: "2026-10-20" }]);
    await runDigest(deps, { sweep: false });
    expect(sent[0]!.text).toMatch(/ONE THING TO DO OUTSIDE TODAY\n\S/);
    expect(sent[0]!.text).toMatch(/\/api\/unsubscribe\?token=[A-Za-z0-9_-]{43}/);
  });

  it("labels sample news so it can never pass for real news", async () => {
    const { sent, deps } = await setup([{ slug: "a", travelDate: "2026-10-20" }]);
    deps.fetchNews = async () => ({ query: "q", items: [{ title: "SAMPLE: x", url: "https://example.com/x", source: null, date: null }], fixture: true });
    deps.summarise = async () => ({ bullets: [{ text: "Something happened.", url: "https://example.com/x", date: null }] });
    await runDigest(deps, { sweep: false });
    expect(sent[0]!.text).toContain("SAMPLE DATA");
  });

  it("refreshes every trek on the weekly sweep", async () => {
    const { calls, deps } = await setup([{ slug: "a", travelDate: "2026-10-20" }]);
    await runDigest(deps, { sweep: true });
    expect(calls.forecast.sort()).toEqual(["a", "b", "c"]);
  });

  it("removes subscriptions whose travel date has passed before sending", async () => {
    const { sent, deps } = await setup([{ slug: "a", travelDate: "2026-10-10" }]);
    const r = await runDigest(deps, { sweep: false });
    expect(r.expired).toBe(1);
    expect(sent).toHaveLength(0);
  });
});
