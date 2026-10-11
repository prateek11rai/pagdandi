import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";
import { TrekTable } from "@/components/trek-table";
import { parseFilters } from "@/lib/filters";
import { listTrekRows } from "@/lib/treks";

export const metadata: Metadata = { title: "Treks" };
export const dynamic = "force-dynamic";

type Params = Promise<Record<string, string | string[] | undefined>>;

export default async function TreksPage({ searchParams }: { searchParams: Params }) {
  const { q, region, month, days, difficulty, budget } = parseFilters(await searchParams);
  const rows = await listTrekRows();
  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-28 pt-8 shell:px-12 shell:pt-11">
      <h1 className="mb-1 text-[32px]">Treks</h1>
      <p className="text-ink-muted">
        {rows.length} treks, every fact sourced. Filter the list, or open a trek for the day-by-day, permits, last signal
        and a printable plan.
      </p>
      <TrekTable rows={rows} initial={{ q, region, month, days, difficulty, budget }} />
      <Link
        href="/"
        className="no-print fixed bottom-20 right-4 z-20 flex items-center gap-2 rounded-full border border-rule bg-paper-raised px-4 py-2 text-sm text-ink no-underline shadow-[0_6px_20px_rgba(0,0,0,0.08)] hover:border-moss hover:text-ink shell:bottom-6 shell:right-7"
      >
        <MessageSquarePlus aria-hidden strokeWidth={1.75} className="size-4 text-moss" />
        Ask the guide about these
      </Link>
    </div>
  );
}
