"use client";

import Link from "next/link";
import { useState } from "react";
import { DAY_BANDS } from "@/lib/filters";
import { formatAltitude, formatBudget, formatDaysShort, formatSeason, MONTH_NAMES } from "@/lib/format";
import { BUDGET_BANDS, DIFFICULTIES, REGIONS } from "@/lib/trek-schema";
import { filterRows, type TableFilters, type TrekRow } from "@/lib/trek-row";
import { cn } from "@/lib/utils";
import { AudioPlayer } from "./audio-player";
import { Badge } from "./ui/badge";

// Below a 54rem container the table turns into stacked rows; each cell then shows its own label.
// (Class names are written out in full so Tailwind can find them.)
const cell = "block @min-[54rem]:table-cell @min-[54rem]:border-b @min-[54rem]:border-rule @min-[54rem]:px-2.5 @min-[54rem]:py-[11px] @min-[54rem]:align-middle";
const labelled =
  "before:mb-0.5 before:block before:text-[10px] before:uppercase before:tracking-[0.12em] before:text-ink-muted before:content-[attr(data-label)] @min-[54rem]:before:content-none";
const field = "h-10 rounded-[9px] border border-rule bg-paper-raised px-3 text-sm text-ink";

export function TrekTable({ rows, initial }: { rows: TrekRow[]; initial: TableFilters }) {
  const [f, setF] = useState<TableFilters>(initial);
  const shown = filterRows(rows, f);

  const update = (next: TableFilters) => {
    setF(next);
    const qs = new URLSearchParams(
      Object.entries(next).flatMap(([k, v]) => (v === undefined || v === "" ? [] : [[k, String(v)]])),
    ).toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };
  const set = (key: keyof TableFilters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    update({ ...f, [key]: e.target.value === "" ? undefined : key === "month" ? Number(e.target.value) : e.target.value });

  return (
    <div className="@container">
      <form role="search" onSubmit={(e) => e.preventDefault()} className="mb-5 mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 @min-[54rem]:flex @min-[54rem]:flex-wrap">
        <input
          type="search"
          aria-label="Trek name"
          placeholder="Trek name"
          value={f.q ?? ""}
          onChange={set("q")}
          maxLength={100}
          className={cn(field, "col-span-full min-w-48 flex-1 placeholder:text-ink-faint")}
        />
        <Filter label="Region" value={f.region} onChange={set("region")} options={Object.entries(REGIONS)} />
        <Filter
          label="Month"
          value={f.month?.toString()}
          onChange={set("month")}
          options={MONTH_NAMES.map((m, i) => [String(i + 1), m])}
        />
        <Filter label="Days" value={f.days} onChange={set("days")} options={Object.entries(DAY_BANDS)} />
        <Filter
          label="Difficulty"
          value={f.difficulty}
          onChange={set("difficulty")}
          options={DIFFICULTIES.map((d) => [d, d[0]!.toUpperCase() + d.slice(1)])}
        />
        <Filter label="Budget" value={f.budget} onChange={set("budget")} options={Object.entries(BUDGET_BANDS)} />
      </form>

      <table className="block w-full border-collapse text-sm @min-[54rem]:table">
        <thead className="hidden @min-[54rem]:table-header-group">
          <tr>
            {["Trek", "State", "Days", "Max alt", "Difficulty", "Season", "Budget (est.)", "Intro"].map((h) => (
              <th key={h} scope="col" className="whitespace-nowrap border-b border-rule px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="block @min-[54rem]:table-row-group">
          {shown.map((r) => (
            <tr
              key={r.slug}
              className="relative grid grid-cols-2 gap-x-4 gap-y-2.5 border-b border-rule py-4 hover:bg-paper-raised @min-[54rem]:table-row @min-[54rem]:border-0 @min-[54rem]:py-0"
            >
              <td className={cn(cell, "col-span-2")}>
                <Link
                  href={`/treks/${r.slug}`}
                  className="font-serif text-[17px] font-semibold leading-tight text-ink no-underline after:absolute after:inset-0 hover:text-moss"
                >
                  {r.name}
                </Link>
                {r.area && <span className="mt-0.5 block text-xs text-ink-muted">{r.area}</span>}
              </td>
              <td data-label="State" className={cn(cell, labelled)}>
                {r.state}
              </td>
              <td data-label="Days" className={cn(cell, labelled, "whitespace-nowrap")}>
                <Value text={r.days === null ? null : formatDaysShort(r.days)} weak={r.weak.includes("days")} />
              </td>
              <td data-label="Max alt" className={cn(cell, labelled, "whitespace-nowrap")}>
                <Value text={r.highestAltitudeM === null ? null : formatAltitude(r.highestAltitudeM)} weak={r.weak.includes("highest_point")} />
              </td>
              <td data-label="Difficulty" className={cn(cell, labelled)}>
                <Badge>{r.difficulty}</Badge>
              </td>
              <td data-label="Season" className={cn(cell, labelled)}>
                <Value text={r.seasonMonths.length ? formatSeason(r.seasonMonths) : null} weak={r.weak.includes("season_months")} />
              </td>
              <td data-label="Budget (est.)" className={cn(cell, labelled, "whitespace-nowrap")}>
                {formatBudget(r.budgetMinInr, r.budgetMaxInr)}
              </td>
              <td data-label="Intro" className={cn(cell, labelled, "col-span-2 whitespace-nowrap")}>
                {r.audioUrl ? <AudioPlayer src={r.audioUrl} title={r.name} /> : <span className="text-ink-muted">not recorded yet</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 flex flex-wrap justify-between gap-x-6 gap-y-1 text-[13px] text-ink-muted" role="status">
        <span>
          Showing {shown.length} of {rows.length} treks
        </span>
        <span>
          <span className="text-clay-ink">weak source</span> marks a fact whose only source we couldn&apos;t fully trust;
          the trek page says why.
        </span>
      </p>
    </div>
  );
}

function Value({ text, weak }: { text: string | null; weak: boolean }) {
  return (
    <>
      {text === null ? <span className="whitespace-nowrap text-ink-muted">not known yet</span> : <span className="whitespace-nowrap">{text}</span>}
      {weak && <span className="ml-1 whitespace-nowrap text-xs text-clay-ink">· weak source</span>}
    </>
  );
}

function Filter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: [string, string][];
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <select aria-label={label} value={value ?? ""} onChange={onChange} className={cn(field, "pr-2", value ? "text-ink" : "text-ink-muted")}>
      <option value="">{label}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
