import { redirect } from "next/navigation";
import { unsubscribe } from "@/lib/subscriptions";
import { sqlSubscriptionStore } from "@/lib/subscriptions-sql";
import { looksLikeToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

async function remove(req: Request): Promise<boolean> {
  const token = new URL(req.url).searchParams.get("token");
  return looksLikeToken(token) ? unsubscribe(token, sqlSubscriptionStore).catch(() => false) : false;
}

// The link in every email.
export async function GET(req: Request) {
  await remove(req);
  redirect("/updates?status=unsubscribed");
}

// One-click unsubscribe from mail clients (List-Unsubscribe-Post); must answer 200.
export async function POST(req: Request) {
  await remove(req);
  return new Response(null, { status: 200 });
}
