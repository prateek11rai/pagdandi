import { env } from "./env";
// In-memory sliding-window limits per client key. One web instance, so memory is enough.
const hits = new Map<string, number[]>();

export interface Limit {
  name: string;
  max: number;
  windowMs: number;
}

export function allow(key: string, limits: Limit[], now = Date.now()): boolean {
  for (const l of limits) {
    const k = `${l.name}:${key}`;
    const recent = (hits.get(k) ?? []).filter((t) => now - t < l.windowMs);
    hits.set(k, recent);
    if (recent.length >= l.max) return false;
  }
  for (const l of limits) hits.get(`${l.name}:${key}`)!.push(now);
  if (hits.size > 10_000) hits.clear(); // crude cap on memory
  return true;
}

// Without a reverse proxy, X-Forwarded-For is whatever the client sends, so it's ignored and every visitor
// shares one budget (on a laptop, the limit protects its CPU). Behind a proxy, set TRUST_PROXY=true.
export function clientKey(req: Request, trustProxy = env().TRUST_PROXY === "true"): string {
  if (!trustProxy) return "local";
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export const CHAT_LIMITS: Limit[] = [
  { name: "chat-min", max: 6, windowMs: 60_000 },
  { name: "chat-hour", max: 40, windowMs: 3_600_000 },
];
export const SUBSCRIBE_LIMITS: Limit[] = [
  { name: "sub-min", max: 3, windowMs: 60_000 },
  { name: "sub-hour", max: 10, windowMs: 3_600_000 },
];
