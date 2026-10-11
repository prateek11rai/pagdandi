import type { Metadata } from "next";
import { Chat } from "@/components/chat";

export const metadata: Metadata = { title: "Ask the trek guide" };

export default function AskPage() {
  return (
    <>
      <section className="relative isolate overflow-hidden border-b hairline">
        <div className="mx-auto max-w-3xl px-4 pb-6 pt-10 sm:px-6">
          <p className="label">Ask</p>
          <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Ask the trek guide</h1>
          <p className="mt-3 text-ink-muted">
            Tell it about your group: how many of you, who has trekked before, budget each, how many days, which month,
            and where you&apos;re starting from. It picks from our database, and every number on the cards comes from
            there. It runs on Gemma, an open model we host ourselves; no model company sees your plans, and chats are
            not stored.
          </p>
        </div>
      </section>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Chat />
      </div>
    </>
  );
}
