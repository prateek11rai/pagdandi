"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "done"; message: string } | { kind: "error"; message: string };

function tomorrowIST(): string {
  const now = new Date(Date.now() + 5.5 * 3600_000 + 86_400_000);
  return now.toISOString().slice(0, 10);
}

export function SubscribeForm({ slug, trekName }: { slug: string; trekName: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), slug, travelDate: form.get("travelDate") }),
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
    <div>
      <p className="mb-3 text-ink-muted">
        One short email each morning at 7:00 IST until you leave: the forecast at the road head and the high point, any
        news since yesterday, and one thing to do outside today to get ready for {trekName}.
      </p>
      <p className="mb-4 border-l-4 border-saffron pl-3 text-sm">
        Preview: daily emails only go to the site admin until we have a domain. If you sign up with another address,
        nothing is stored.
      </p>
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
        <div>
          <label htmlFor="sub-email" className="label">
            Email
          </label>
          <Input id="sub-email" name="email" type="email" required maxLength={254} autoComplete="email" className="mt-1" />
        </div>
        <div>
          <label htmlFor="sub-date" className="label">
            First day of travel
          </label>
          <Input id="sub-date" name="travelDate" type="date" required min={tomorrowIST()} className="mt-1" />
        </div>
        <Button type="submit" disabled={state.kind === "sending"}>
          {state.kind === "sending" ? "Sending…" : "Get daily updates"}
        </Button>
      </form>
      <p role="status" aria-live="polite" className="mt-3 min-h-6 text-sm">
        {state.kind === "done" && state.message}
        {state.kind === "error" && <span className="text-clay-ink">{state.message}</span>}
      </p>
    </div>
  );
}
