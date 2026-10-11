import { describe, expect, it } from "vitest";
import { EnvError, parseEnv } from "@/lib/env";

const base = { DATABASE_URL: "postgres://u@localhost:5432/db", ADMIN_EMAIL: "admin@example.com" };

describe("env validation", () => {
  it("accepts the minimum for the web app and applies defaults", () => {
    const e = parseEnv("web", base);
    expect(e.EMAIL_MODE).toBe("dry-run");
    expect(e.SERPAPI_MONTHLY_CAP).toBe(200);
  });

  it("names every missing variable", () => {
    expect(() => parseEnv("web", {})).toThrowError(EnvError);
    try {
      parseEnv("web", {});
    } catch (e) {
      expect((e as Error).message).toMatch(/DATABASE_URL is missing/);
      expect((e as Error).message).toMatch(/ADMIN_EMAIL is missing/);
    }
  });

  it("requires the Resend key only when sending for real", () => {
    expect(() => parseEnv("web", { ...base, EMAIL_MODE: "resend" })).toThrow(/RESEND_API_KEY is missing/);
    expect(() => parseEnv("web", { ...base, EMAIL_MODE: "resend", RESEND_API_KEY: "x" })).not.toThrow();
  });

  it("requires the SerpApi key only for live news in the digest", () => {
    expect(() => parseEnv("digest", { ...base, NEWS_MODE: "serpapi" })).toThrow(/SERPAPI_API_KEY is missing/);
    expect(() => parseEnv("web", { ...base, NEWS_MODE: "serpapi" })).not.toThrow();
  });

  it("uses live Open-Meteo forecasts unless fixtures are asked for", () => {
    expect(parseEnv("digest", base).FORECAST_MODE).toBe("open-meteo");
    expect(parseEnv("digest", { ...base, FORECAST_MODE: "fixtures" }).FORECAST_MODE).toBe("fixtures");
    expect(() => parseEnv("digest", { ...base, FORECAST_MODE: "live" })).toThrow(/FORECAST_MODE is invalid/);
  });

  it("treats empty strings as unset", () => {
    expect(() => parseEnv("web", { ...base, ADMIN_EMAIL: "" })).toThrow(/ADMIN_EMAIL is missing/);
  });

  it("rejects a non-Postgres URL", () => {
    expect(() => parseEnv("db", { DATABASE_URL: "mysql://x" })).toThrow(/DATABASE_URL is invalid/);
  });
});
