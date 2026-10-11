import { z } from "zod";

// Which parts of the app need which variables. Each entry point validates only what it uses.
export type EnvScope = "web" | "digest" | "db" | "audio" | "model";

const postgresUrl = z.string().regex(/^postgres(ql)?:\/\/.+/, "must be a postgres:// URL");
const httpUrl = z.url({ protocol: /^https?$/ });
const positiveInt = z.coerce.number().int().positive();

const schema = z.object({
  DATABASE_URL: postgresUrl,
  OLLAMA_BASE_URL: httpUrl.default("http://127.0.0.1:11434"),
  // Chats go to Ollama, so it must be on this machine unless someone opts in on purpose.
  OLLAMA_ALLOW_REMOTE: z.enum(["true", "false"]).default("false"),
  // Only behind a reverse proxy that sets X-Forwarded-For; otherwise any client could pick its own address.
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
  CHAT_MODEL: z.string().min(1).default("gemma4:e4b"),
  EMBED_MODEL: z.string().min(1).default("embeddinggemma:300m"),
  SITE_URL: httpUrl.default("http://localhost:3000"),
  ADMIN_EMAIL: z.email(),
  EMAIL_MODE: z.enum(["dry-run", "smtp"]).default("dry-run"),
  // SMTP from the admin's own mailbox: 587 with STARTTLS by default, or 465 with implicit TLS.
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).optional(), // defaults to SMTP_USER
  FORECAST_MODE: z.enum(["open-meteo", "fixtures"]).default("open-meteo"),
  NEWS_MODE: z.enum(["fixtures", "serpapi"]).default("fixtures"),
  SERPAPI_API_KEY: z.string().min(1).optional(),
  SERPAPI_DAILY_CAP: positiveInt.default(25),
  SERPAPI_MONTHLY_CAP: positiveInt.default(200),
  ELEVENLABS_API_KEY: z.string().min(1).optional(),
  ELEVENLABS_VOICE_ID: z.string().min(1).optional(),
});

export type Env = z.infer<typeof schema>;

const NEEDS: Record<EnvScope, (keyof Env)[]> = {
  db: ["DATABASE_URL"],
  web: ["DATABASE_URL", "ADMIN_EMAIL"],
  digest: ["DATABASE_URL", "ADMIN_EMAIL"],
  audio: ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"],
  model: [], // local Gemma only; Ollama settings have defaults
};

const HINTS: Partial<Record<keyof Env, string>> = {
  DATABASE_URL: "Postgres URL. Locally `pnpm dev:up` prints it; with Tiger Data, use its service URL.",
  ADMIN_EMAIL: "the site admin's email; the only address daily emails go to until we have a domain.",
  SMTP_HOST: "needed when EMAIL_MODE=smtp: your mailbox's SMTP server, e.g. smtp.gmail.com.",
  SMTP_USER: "needed when EMAIL_MODE=smtp: the mailbox's login, usually its email address.",
  SMTP_PASS: "needed when EMAIL_MODE=smtp: the mailbox's password; for Gmail, an app password.",
  SERPAPI_API_KEY: "needed when NEWS_MODE=serpapi. Find it in your SerpApi dashboard.",
  ELEVENLABS_API_KEY: "needed by `pnpm audio`. Create one in ElevenLabs settings.",
  ELEVENLABS_VOICE_ID: "needed by `pnpm audio`. Pick a voice in the ElevenLabs voice library.",
};

export class EnvError extends Error {}

export function parseEnv(scope: EnvScope, source: Record<string, string | undefined> = process.env): Env {
  // Empty strings in .env mean "not set".
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ""));
  const required = new Set<keyof Env>(NEEDS[scope]);
  const smtp = (scope === "web" || scope === "digest") && cleaned.EMAIL_MODE === "smtp";
  if (smtp) for (const k of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"] as const) required.add(k);
  if (scope === "digest" && cleaned.NEWS_MODE === "serpapi") required.add("SERPAPI_API_KEY");

  const problems: string[] = [];
  for (const key of required) {
    if (!(key in cleaned)) problems.push(`${key} is missing: ${HINTS[key] ?? "required."}`);
  }
  const optionalised = schema.partial({ DATABASE_URL: true, ADMIN_EMAIL: true });
  const result = optionalised.safeParse(cleaned);
  if (!result.success) {
    for (const i of result.error.issues) problems.push(`${i.path.join(".")} is invalid: ${i.message}`);
  }
  if (smtp && result.success && result.data.SMTP_USER && !z.email().safeParse(addressIn(result.data.EMAIL_FROM ?? result.data.SMTP_USER)).success) {
    problems.push("EMAIL_FROM is missing: SMTP_USER isn't an email address, so set EMAIL_FROM to the address emails come from.");
  }
  if (result.success && result.data.OLLAMA_ALLOW_REMOTE !== "true" && !isLoopback(result.data.OLLAMA_BASE_URL)) {
    problems.push(
      "OLLAMA_BASE_URL is invalid: it must point at this machine (127.0.0.1, ::1 or localhost), because chats are sent to it. Set OLLAMA_ALLOW_REMOTE=true to use another host on purpose.",
    );
  }
  if (problems.length > 0) {
    throw new EnvError(`Environment is not ready (${scope}):\n  - ${problems.join("\n  - ")}\nSee .env.example.`);
  }
  return result.data as Env;
}

// "Name <a@b.c>" or "a@b.c" -> "a@b.c"
export function addressIn(from: string): string {
  return /<([^>]+)>\s*$/.exec(from)?.[1]?.trim() ?? from.trim();
}

export function isLoopback(url: string): boolean {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "::1" || /^127(\.\d{1,3}){3}$/.test(host);
}

const cache = new Map<EnvScope, Env>();

// Validate once per scope. Entry points call loadEnv() with their scope at startup;
// library code calls env(), which reuses whatever was validated first.
export function loadEnv(scope: EnvScope): Env {
  let e = cache.get(scope);
  if (!e) {
    e = parseEnv(scope);
    cache.set(scope, e);
  }
  return e;
}

export function env(): Env {
  return cache.values().next().value ?? loadEnv("db");
}
