import { z } from "zod";
import { mailer } from "@/lib/email";
import { env } from "@/lib/env";
import { allow, clientKey, SUBSCRIBE_LIMITS } from "@/lib/rate-limit";
import { PREVIEW_MESSAGE, subscribe } from "@/lib/subscriptions";
import { sqlSubscriptionStore } from "@/lib/subscriptions-sql";
import { getTrek } from "@/lib/treks";

export const dynamic = "force-dynamic";

const input = z.object({
  email: z.email().max(254),
  slug: z.string().regex(/^[a-z0-9-]{2,60}$/),
  travelDate: z.iso.date(),
});
const json = (status: number, message: string) => Response.json({ message }, { status });

export async function POST(req: Request) {
  if (!allow(clientKey(req), SUBSCRIBE_LIMITS)) return json(429, "Too many sign-ups from here. Please try later.");
  const body = await req.json().catch(() => null);
  const parsed = input.safeParse(body);
  if (!parsed.success) return json(400, "Please check the email address and the travel date.");

  try {
    const trek = await getTrek(parsed.data.slug);
    if (!trek) return json(400, "That trek isn't in our database.");
    const e = env();
    const result = await subscribe(parsed.data, {
      store: sqlSubscriptionStore,
      mailer: mailer(),
      adminEmail: e.ADMIN_EMAIL,
      siteUrl: e.SITE_URL,
      trekName: trek.name,
    });
    if (result.kind === "preview") return json(200, PREVIEW_MESSAGE);
    if (result.kind === "invalid") return json(400, result.message);
    return json(200, "Almost done: check your inbox for the confirmation link.");
  } catch {
    return json(503, "Sign-up isn't working right now. Please try again later.");
  }
}
