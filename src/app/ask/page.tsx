import type { Metadata } from "next";

export const metadata: Metadata = { title: "Ask the trek guide" };

export default function AskPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="display text-4xl font-semibold">Ask the trek guide</h1>
      <p className="mt-3 text-ink-muted">Coming in the next build step.</p>
    </div>
  );
}
