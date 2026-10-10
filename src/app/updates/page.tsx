import type { Metadata } from "next";
import Link from "next/link";
import { TopoBackdrop } from "@/components/topo-pattern";

export const metadata: Metadata = { title: "Daily updates" };

const STATUS: Record<string, string> = {
  confirmed: "You're subscribed. The first email arrives at 7:00 IST tomorrow.",
  unsubscribed: "Done. You won't get any more emails, and we've deleted the subscription.",
  invalid: "That link has expired or was already used.",
};

type Params = Promise<Record<string, string | string[] | undefined>>;

export default async function UpdatesPage({ searchParams }: { searchParams: Params }) {
  const p = await searchParams;
  const status = typeof p.status === "string" ? STATUS[p.status] : undefined;
  return (
    <>
      <section className="relative isolate overflow-hidden border-b hairline">
        <TopoBackdrop />
        <div className="mx-auto max-w-3xl px-4 pb-6 pt-10 sm:px-6">
          <p className="label">Updates</p>
          <h1 className="display mt-2 text-4xl font-semibold sm:text-5xl">Daily updates until you leave</h1>
        </div>
      </section>
      <div className="mx-auto grid max-w-3xl gap-6 px-4 py-8 sm:px-6">
        {status && (
          <p role="status" className="border-l-4 border-moss bg-paper-raised p-3">
            {status}
          </p>
        )}
        <p>
          Pick a trek, then choose <strong>Get daily updates</strong> on its page and give your first day of travel. Every
          morning at 7:00 IST until then, one short email:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>the forecast at the road head and, as an estimate, at the high point;</li>
          <li>any news since yesterday about closures, landslides, snowfall or permits, each with its link and date;</li>
          <li>one thing to do outside today, like a practice walk in your trek boots.</li>
        </ul>
        <p className="border-l-4 border-saffron pl-3">
          <strong>Preview:</strong> daily emails only go to the site admin until we have a domain. Our email provider&apos;s
          test sender can only deliver to its account owner. If you sign up with any other address, you&apos;ll see a
          preview message and <strong>nothing is stored</strong>.
        </p>
        <p className="text-ink-muted">
          For the admin: sign-ups need a click on a confirmation link, every email has an unsubscribe link, and a
          subscription is deleted the day after the travel date. Links use random tokens that we store only as hashes.
        </p>
        <p>
          <Link href="/">Find a trek</Link>
        </p>
      </div>
    </>
  );
}
