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

  it("names each missing SMTP setting only when sending for real", () => {
    expect(() => parseEnv("web", base)).not.toThrow();
    try {
      parseEnv("digest", { ...base, EMAIL_MODE: "smtp" });
      expect.unreachable();
    } catch (e) {
      for (const k of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"]) expect((e as Error).message).toContain(`${k} is missing`);
    }
    const smtp = { ...base, EMAIL_MODE: "smtp", SMTP_HOST: "smtp.example.com", SMTP_USER: "admin@example.com", SMTP_PASS: "x" };
    expect(parseEnv("web", smtp).SMTP_PORT).toBe(587);
    expect(parseEnv("web", { ...smtp, SMTP_PORT: "465" }).SMTP_PORT).toBe(465);
    expect(() => parseEnv("web", { ...smtp, SMTP_USER: "mailbox-login" })).toThrow(/EMAIL_FROM is missing/);
    expect(() => parseEnv("web", { ...smtp, SMTP_USER: "mailbox-login", EMAIL_FROM: "Pagdandi <admin@example.com>" })).not.toThrow();
    expect(() => parseEnv("web", { ...base, EMAIL_MODE: "resend" })).toThrow(/EMAIL_MODE is invalid/);
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

  it("keeps Ollama on this machine unless a remote host is allowed on purpose", () => {
    expect(parseEnv("web", base).OLLAMA_BASE_URL).toBe("http://127.0.0.1:11434");
    for (const url of ["http://localhost:11434", "http://127.0.0.2:11434", "http://[::1]:11434"]) {
      expect(() => parseEnv("web", { ...base, OLLAMA_BASE_URL: url })).not.toThrow();
    }
    expect(() => parseEnv("web", { ...base, OLLAMA_BASE_URL: "http://10.0.0.5:11434" })).toThrow(/must point at this machine/);
    expect(() => parseEnv("web", { ...base, OLLAMA_BASE_URL: "http://127.0.0.1.example.com:11434" })).toThrow(/must point at this machine/);
    expect(() => parseEnv("web", { ...base, OLLAMA_BASE_URL: "http://10.0.0.5:11434", OLLAMA_ALLOW_REMOTE: "true" })).not.toThrow();
  });

  it("treats empty strings as unset", () => {
    expect(() => parseEnv("web", { ...base, ADMIN_EMAIL: "" })).toThrow(/ADMIN_EMAIL is missing/);
  });

  it("rejects a non-Postgres URL", () => {
    expect(() => parseEnv("db", { DATABASE_URL: "mysql://x" })).toThrow(/DATABASE_URL is invalid/);
  });
});
