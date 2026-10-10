import { redirect } from "next/navigation";
import { confirm } from "@/lib/subscriptions";
import { sqlSubscriptionStore } from "@/lib/subscriptions-sql";
import { looksLikeToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const sub = looksLikeToken(token) ? await confirm(token, sqlSubscriptionStore).catch(() => null) : null;
  redirect(sub ? `/updates?status=confirmed&trek=${sub.slug}` : "/updates?status=invalid");
}
