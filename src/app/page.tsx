import Link from "next/link";
import { Search } from "lucide-react";
import { TopoBackdrop } from "@/components/topo-pattern";
import { TrekCard } from "@/components/trek-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { DAY_BANDS, parseFilters, type TrekFilters } from "@/lib/filters";
import { MONTH_NAMES } from "@/lib/format";
import { searchTreks } from "@/lib/search";
import { BUDGET_BANDS, DIFFICULTIES, REGIONS } from "@/lib/trek-schema";
import { listTreks } from "@/lib/treks";

export const dynamic = "force-dynamic";

type Params = Promise<Record<string, string | string[] | undefined>>;

export default async function TreksPage({ searchParams }: { searchParams: Params }) {
  const filters = parseFilters(await searchParams);
  const cards = filters.q ? (await searchTreks(filters.q, filters)).cards : await listTreks(filters);
  const filtered = Object.entries(filters).some(([k, v]) => k !== "q" && v !== undefined);

  return (
    <>
      <section className="relative isolate overflow-hidden border-b hairline">
        <TopoBackdrop />
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6 sm:pb-12 sm:pt-16">
          <p className="label">India&apos;s open trek database</p>
          <h1 className="display mt-2 max-w-3xl text-4xl font-semibold sm:text-6xl">
            Find a trek your whole group can actually do.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-muted">
            Search by what you want, not just by name. Listen to the intro, pick one, and get the conditions every
            morning until you leave. Then put the phone away.
          </p>
          <SearchForm filters={filters} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6" aria-labelledby="results-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b hairline pb-2">
          <h2 id="results-heading" className="text-2xl font-semibold">
            {filters.q ? <>Treks for &ldquo;{filters.q}&rdquo;</> : "All treks"}
          </h2>
          <p className="label">
            {cards.length} {cards.length === 1 ? "trek" : "treks"}
            {(filters.q || filtered) && (
              <>
                {" · "}
                <Link href="/" className="normal-case tracking-normal">
                  clear
                </Link>
              </>
            )}
          </p>
        </div>
        {cards.length === 0 ? (
          <p className="mt-6 text-ink-muted">
            Nothing matches yet. Try fewer filters, or <Link href="/ask">ask the trek guide</Link>.
          </p>
        ) : (
          <ul className="mt-6 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((t) => (
              <li key={t.slug}>
                <TrekCard trek={t} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function SearchForm({ filters }: { filters: TrekFilters }) {
  return (
    <form action="/" method="get" role="search" className="mt-8 max-w-4xl">
      <label htmlFor="q" className="label">
        Describe the trek you want
      </label>
      <div className="mt-1.5 flex gap-2">
        <Input
          id="q"
          name="q"
          type="search"
          maxLength={200}
          defaultValue={filters.q ?? ""}
          placeholder="easy snow trek in December"
          className="text-lg"
        />
        <Button type="submit" aria-label="Search">
          <Search aria-hidden />
          <span className="hidden sm:inline">Search</span>
        </Button>
      </div>
      <fieldset className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <legend className="sr-only">Filters</legend>
        <Filter name="region" label="Region" value={filters.region} options={Object.entries(REGIONS)} />
        <Filter
          name="month"
          label="Month"
          value={filters.month?.toString()}
          options={MONTH_NAMES.map((m, i) => [String(i + 1), m])}
        />
        <Filter name="days" label="Days" value={filters.days} options={Object.entries(DAY_BANDS)} />
        <Filter
          name="difficulty"
          label="Difficulty"
          value={filters.difficulty}
          options={DIFFICULTIES.map((d) => [d, d[0]!.toUpperCase() + d.slice(1)])}
        />
        <Filter name="budget" label="Budget (est.)" value={filters.budget} options={Object.entries(BUDGET_BANDS)} />
      </fieldset>
    </form>
  );
}

function Filter({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string | undefined;
  options: [string, string][];
}) {
  return (
    <div>
      <label htmlFor={`f-${name}`} className="label">
        {label}
      </label>
      <NativeSelect id={`f-${name}`} name={name} defaultValue={value ?? ""} className="mt-1">
        <option value="">Any</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
