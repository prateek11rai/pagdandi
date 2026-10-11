import type { Metadata } from "next";
import { SubscribeForm } from "@/components/subscribe-form";
import { Badge } from "@/components/ui/badge";
import { listTreks } from "@/lib/treks";

export const metadata: Metadata = { title: "Daily updates" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  confirmed: "You're subscribed. The first email arrives at 7:00 IST tomorrow.",
  unsubscribed: "Done. You won't get any more emails, and we've deleted the subscription.",
  invalid: "That link has expired or was already used.",
};

type Params = Promise<Record<string, string | string[] | undefined>>;

export default async function UpdatesPage({ searchParams }: { searchParams: Params }) {
  const p = await searchParams;
  const status = typeof p.status === "string" ? STATUS[p.status] : undefined;
  const treks = (await listTreks()).map((t) => ({ slug: t.slug, name: t.name }));
  const initialSlug = typeof p.trek === "string" && treks.some((t) => t.slug === p.trek) ? p.trek : undefined;

  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-16 pt-8 shell:px-12 shell:pt-11">
      <h1 className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[32px]">
        Daily updates <Badge variant="highlight">coming soon</Badge>
      </h1>
      {status && (
        <p role="status" className="my-4 rounded-r-lg border-l-[3px] border-moss bg-paper-deep px-3.5 py-2.5 text-sm">
          {status}
        </p>
      )}
      <p className="max-w-[640px] text-ink-muted">
        One short email every morning at 7:00 IST until the day you leave: the forecast at the road head and the high
        point, any news since yesterday (closures, landslides, snowfall, permits), and one thing to do outside today to get
        ready.
      </p>
      <p className="my-[18px] rounded-r-lg border-l-[3px] border-saffron bg-paper-deep px-3.5 py-2.5 text-sm">
        <strong>Emails don&apos;t go out yet.</strong> Pagdandi has no domain of its own, so only the site admin receives
        them for now. If you sign up with another address, nothing is stored. We&apos;ll switch this on once the domain
        exists.
      </p>

      <div className="@container">
        <div className="grid items-start gap-x-7 gap-y-10 @min-[50rem]:grid-cols-2">
          <SubscribeForm treks={treks} initialSlug={initialSlug} />
          <div>
            <h2 className="mb-1.5 font-sans text-[11px] font-normal uppercase tracking-[0.12em] text-ink-muted">
              What the morning email looks like
            </h2>
            <SampleEmail />
            <h2 className="mb-1.5 mt-6 border-b border-rule pb-1 text-[19px]">Meanwhile</h2>
            <p className="text-ink-muted">
              The same forecast and news appear on each trek&apos;s page under &ldquo;Today&apos;s conditions&rdquo;.
              Print the one-page plan and download the audio, so the phone stays in your pocket on the trail.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// An example, laid out like the real email (src/jobs/digest-core.ts): subject, forecast at both places, news,
// and a line from the hand-written list of things to do outside.
function SampleEmail() {
  return (
    <div role="group" aria-label="Example email" className="rounded-xl border border-rule bg-paper-raised px-4 py-3.5">
      <p className="text-xs text-ink-muted">From Pagdandi · 7:00 IST</p>
      <p className="mb-2.5 mt-1 font-serif text-[17px] font-semibold leading-snug">Kedarkantha · 12 days to go · all clear so far</p>
      <dl className="mb-2.5 flex flex-wrap gap-x-[18px] gap-y-1.5 text-[13px]">
        <div>
          <dt className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">Sankri</dt>
          <dd className="font-semibold">Clear, 4 to 14 °C</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">Summit (est.)</dt>
          <dd className="font-semibold">Snow, −6 to 2 °C</dd>
        </div>
      </dl>
      <p className="mb-2.5 text-sm">
        <strong>News since yesterday:</strong> nothing new.
      </p>
      <p className="rounded-r-lg border-l-[3px] border-clay bg-paper-deep px-3.5 py-2.5 text-sm">
        One thing to do outside today: break in your socks and boots together on a 5 km walk, then check your feet.
      </p>
    </div>
  );
}
