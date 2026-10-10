import { z } from "zod";

// Which parts of the app need which variables. Each entry point validates only what it uses.
export type EnvScope = "web" | "digest" | "db" | "audio" | "model";

const postgresUrl = z.string().regex(/^postgres(ql)?:\/\/.+/, "must be a postgres:// URL");
const httpUrl = z.url({ protocol: /^https?$/ });
const positiveInt = z.coerce.number().int().positive();

const schema = z.object({
  DATABASE_URL: postgresUrl,
  OLLAMA_BASE_URL: httpUrl.default("http://127.0.0.1:11434"),
  CHAT_MODEL: z.string().min(1).default("gemma4:e4b"),
  EMBED_MODEL: z.string().min(1).default("embeddinggemma:300m"),
  SITE_URL: httpUrl.default("http://localhost:3000"),
  ADMIN_EMAIL: z.email(),
  EMAIL_MODE: z.enum(["dry-run", "resend"]).default("dry-run"),
  EMAIL_FROM: z.string().min(3).default("Pagdandi <onboarding@resend.dev>"),
  RESEND_API_KEY: z.string().min(1).optional(),
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
  DATABASE_URL: "Postgres URL. Locally `pnpm dev:up` prints it; in production use the Tiger Data service URL.",
  ADMIN_EMAIL: "the site admin's email; the only address daily emails go to until we have a domain.",
  RESEND_API_KEY: "needed when EMAIL_MODE=resend. Create one at resend.com.",
  SERPAPI_API_KEY: "needed when NEWS_MODE=serpapi. Find it in your SerpApi dashboard.",
  ELEVENLABS_API_KEY: "needed by `pnpm audio`. Create one in ElevenLabs settings.",
  ELEVENLABS_VOICE_ID: "needed by `pnpm audio`. Pick a voice in the ElevenLabs voice library.",
};

export class EnvError extends Error {}

export function parseEnv(scope: EnvScope, source: Record<string, string | undefined> = process.env): Env {
  // Empty strings in .env mean "not set".
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ""));
  // Render Blueprints can only pass the private service's host:port.
  if (!cleaned.OLLAMA_BASE_URL && cleaned.OLLAMA_HOSTPORT) cleaned.OLLAMA_BASE_URL = `http://${cleaned.OLLAMA_HOSTPORT}`;
  const required = new Set<keyof Env>(NEEDS[scope]);
  if (scope !== "audio" && cleaned.EMAIL_MODE === "resend") required.add("RESEND_API_KEY");
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
  if (problems.length > 0) {
    throw new EnvError(`Environment is not ready (${scope}):\n  - ${problems.join("\n  - ")}\nSee .env.example.`);
  }
  return result.data as Env;
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
