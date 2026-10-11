"use client";

import { useState } from "react";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "done"; message: string } | { kind: "error"; message: string };

function tomorrowIST(): string {
  const now = new Date(Date.now() + 5.5 * 3600_000 + 86_400_000);
  return now.toISOString().slice(0, 10);
}

const field = "mt-1 h-11 w-full rounded-[9px] border border-rule bg-paper-raised px-3 text-[15px] text-ink placeholder:text-ink-faint";
const label = "block text-[11px] uppercase tracking-[0.12em] text-ink-muted";

// Only the admin's address is stored and confirmed; any other address gets a preview message (see the route).
export function SubscribeForm({ treks, initialSlug }: { treks: { slug: string; name: string }[]; initialSlug?: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), slug: form.get("slug"), travelDate: form.get("travelDate") }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      setState(
        res.ok
          ? { kind: "done", message: body.message ?? "Check your inbox to confirm." }
          : { kind: "error", message: body.message ?? "That didn't work. Please try again later." },
      );
    } catch {
      setState({ kind: "error", message: "That didn't work. Please try again later." });
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-[560px] gap-3.5">
      <div>
        <label htmlFor="sub-trek" className={label}>
          Trek
        </label>
        <select id="sub-trek" name="slug" required defaultValue={initialSlug ?? ""} className={field}>
          <option value="" disabled>
            Choose a trek
          </option>
          {treks.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="sub-date" className={label}>
          First day of travel
        </label>
        <input id="sub-date" name="travelDate" type="date" required min={tomorrowIST()} className={field} />
      </div>
      <div>
        <label htmlFor="sub-email" className={label}>
          Email
        </label>
        <input
          id="sub-email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="you@example.com"
          className={field}
        />
      </div>
      <div>
        <button
          type="submit"
          disabled={state.kind === "sending"}
          className="mt-1 rounded-[9px] bg-moss px-3.5 py-2.5 text-sm font-medium text-white hover:bg-moss-strong disabled:opacity-60"
        >
          {state.kind === "sending" ? "Sending…" : "Get daily updates"}
        </button>
      </div>
      <p role="status" aria-live="polite" className="min-h-6 text-sm">
        {state.kind === "done" && state.message}
        {state.kind === "error" && <span className="text-clay-ink">{state.message}</span>}
      </p>
    </form>
  );
}
