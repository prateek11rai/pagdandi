"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ExternalLink, Mail, Printer } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import type { TrekCard as TrekCardData } from "@/lib/treks";
import { ALTITUDE_SAFETY_THRESHOLD_M } from "@/lib/trek-schema";
import { cn } from "@/lib/utils";
import { Composer, MAX_CHARS } from "./composer";
import { NEW_PLAN_EVENT } from "./nav";
import { TrekCard } from "./trek-card";

export const CHIPS = [
  "5 of us, 2 first-timers, ₹12k each, 4 days in December, from Delhi",
  "A day hike near Mumbai this weekend",
  "Lakes high in the mountains with wildflowers",
];

interface RecommendOutput {
  cards: TrekCardData[];
  reasons: Record<string, string>;
}

// The chat lives only in this component's memory: nothing is stored, here or on the server.
const transport = new DefaultChatTransport({ api: "/api/chat" });

type Phase = "intro" | "leaving" | "thread";

export function NewPlan({ featured, total }: { featured: TrekCardData[]; total: number }) {
  const { messages, sendMessage, status, error, setMessages, stop } = useChat({ transport });
  const [phase, setPhase] = useState<Phase>("intro");
  const [focusDock, setFocusDock] = useState(false);
  const busy = status === "submitted" || status === "streaming";

  const send = (text: string, fromComposer: boolean) => {
    const t = text.trim();
    if (!t || busy) return;
    void sendMessage({ text: t.slice(0, MAX_CHARS) });
    if (phase !== "intro") return;
    setFocusDock(fromComposer);
    setPhase("leaving");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => setPhase("thread"), reduce ? 0 : 300);
  };

  // "New plan" while already here: start over.
  useEffect(() => {
    const reset = () => {
      void stop();
      setMessages([]);
      setPhase("intro");
      window.scrollTo(0, 0);
    };
    window.addEventListener(NEW_PLAN_EVENT, reset);
    return () => window.removeEventListener(NEW_PLAN_EVENT, reset);
  }, [stop, setMessages]);

  // Keep the newest turn in view.
  useEffect(() => {
    if (phase === "thread") window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [phase, messages.length]);

  return (
    <>
      <div className="mx-auto max-w-[800px] px-4 shell:px-6">
        {phase === "thread" ? (
          <Conversation messages={messages} busy={busy} error={error} />
        ) : (
          <div
            className={cn(
              "pb-16 pt-14 transition-[opacity,transform] duration-300 ease-out shell:pt-[150px]",
              phase === "leaving" && "-translate-y-2.5 opacity-0",
            )}
          >
            <h1 className="mb-5 text-[32px] shell:text-[40px]">Which trek can your group actually do?</h1>
            <Composer
              label="Tell the guide about your group"
              placeholder="Tell the guide about your group: how many of you, who has trekked before, budget each, how many days, which month, and where you're starting from."
              meta={`Answers come from ${total} sourced Indian treks.`}
              disabled={busy}
              onSend={(t) => send(t, true)}
            />
            <ul className="mt-3.5 flex flex-wrap gap-2" aria-label="Suggestions">
              {CHIPS.map((c) => (
                <li key={c}>
                  <button
                    type="button"
                    onClick={() => send(c, false)}
                    className="rounded-full border hairline bg-paper-raised px-3 py-1.5 text-left text-sm hover:border-moss"
                  >
                    {c}
                  </button>
                </li>
              ))}
            </ul>

            <section aria-labelledby="featured-h" className="mt-20 border-t hairline pt-5">
              <div className="flex items-baseline justify-between gap-4">
                <h2 id="featured-h" className="font-sans text-xs font-normal uppercase tracking-[0.12em] text-ink-muted">
                  Check out some treks
                </h2>
                <Link href="/treks" className="text-sm font-medium no-underline">
                  All {total} treks →
                </Link>
              </div>
              <ul className="mt-4 grid gap-3.5 sm:grid-cols-3">
                {featured.map((t) => (
                  <li key={t.slug}>
                    <TrekCard trek={t} />
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>

      {/* Outside the animated column, so `position: fixed` is relative to the viewport. */}
      {phase === "thread" && (
        <div className="no-print fixed inset-x-0 bottom-16 z-20 bg-[linear-gradient(transparent,var(--paper)_40%)] px-4 pb-4 pt-6 shell:bottom-0 shell:left-[272px] shell:px-6 shell:pb-[22px]">
          <div className="mx-auto max-w-[800px]">
            <Composer
              label="Ask a follow-up"
              placeholder="Ask a follow-up, for example: what if one of us can only do 3 days?"
              meta="The guide only recommends treks from the database."
              disabled={busy}
              focusOnMount={focusDock}
              onSend={(t) => send(t, true)}
            />
          </div>
        </div>
      )}
    </>
  );
}

function Conversation({ messages, busy, error }: { messages: UIMessage[]; busy: boolean; error: Error | undefined }) {
  const last = messages.at(-1);
  const waiting = busy && (last?.role !== "assistant" || !hasContent(last));
  return (
    <div className="pb-[200px] pt-9">
      <ol className="flex flex-col gap-[18px]" aria-busy={busy}>
        {messages.map((m) =>
          m.role === "user" ? (
            <li key={m.id} className="fade-in max-w-[72%] self-end rounded-[14px_14px_4px_14px] bg-paper-deep px-3.5 py-2.5">
              {textOf(m)}
            </li>
          ) : hasContent(m) ? (
            <li key={m.id} className="fade-in">
              <GuideTurn message={m} />
            </li>
          ) : null,
        )}
        {waiting && (
          <li role="status" className="flex items-center gap-1 text-sm text-ink-muted">
            <span aria-hidden className="typing-dot" />
            <span aria-hidden className="typing-dot" />
            <span aria-hidden className="typing-dot mr-1.5" />
            The guide is searching the treks…
          </li>
        )}
      </ol>
      {error && (
        <p role="alert" className="mt-4 text-sm text-clay-ink">
          {friendlyError(error)}
        </p>
      )}
    </div>
  );
}

function textOf(m: UIMessage): string {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

function recommendation(m: UIMessage): RecommendOutput | null {
  const part = m.parts.findLast((p) => p.type === "tool-recommendTreks" && p.state === "output-available");
  return part && "output" in part ? (part.output as RecommendOutput) : null;
}

function hasContent(m: UIMessage): boolean {
  return textOf(m).trim().length > 0 || recommendation(m) !== null;
}

// The chat route answers errors with {"message": "..."}; show that, or a plain fallback.
function friendlyError(e: Error): string {
  try {
    const body = JSON.parse(e.message) as { message?: unknown };
    if (typeof body.message === "string") return body.message;
  } catch {}
  return "The trek guide is having trouble right now. Please try again in a minute.";
}

function GuideTurn({ message }: { message: UIMessage }) {
  const text = textOf(message).trim();
  const rec = recommendation(message);
  return (
    <>
      {text && <Prose text={text} />}
      {rec && rec.cards.length > 0 && <Recommendations output={rec} />}
    </>
  );
}

function Recommendations({ output }: { output: RecommendOutput }) {
  const high = output.cards.filter((c) => (c.highestAltitudeM ?? 0) > ALTITUDE_SAFETY_THRESHOLD_M);
  const top = output.cards[0]!;
  return (
    <div className="mt-3">
      <ul className="grid gap-3.5 sm:grid-cols-3">
        {output.cards.map((c) => (
          <li key={c.slug}>
            <TrekCard trek={c} third="budget" reason={output.reasons[c.slug]} newTab />
          </li>
        ))}
      </ul>
      {high.length > 0 && (
        <p className="mt-3.5 rounded-r-lg border-l-[3px] border-clay bg-paper-deep px-3.5 py-2.5 text-sm">
          {high.map((c) => c.name).join(" and ")} {high.length === 1 ? "goes" : "go"} above 3,500 m: climb gradually, drink
          water, and turn back if headache or breathlessness gets worse. Not medical advice; read the official advisory
          before you go.
        </p>
      )}
      <div className="mt-3.5 flex flex-wrap gap-2">
        <Action href={`/updates?trek=${top.slug}`} primary icon={<Mail aria-hidden strokeWidth={1.75} className="size-4" />}>
          Get daily updates for {top.name}
        </Action>
        <Action href={`/treks/${top.slug}`} icon={<ExternalLink aria-hidden strokeWidth={1.75} className="size-4" />}>
          Open the trek page
        </Action>
        <Action href={`/treks/${top.slug}?print=1`} icon={<Printer aria-hidden strokeWidth={1.75} className="size-4" />}>
          Print the one-page plan
        </Action>
      </div>
    </div>
  );
}

// Actions open in a new tab, so the plan in this one isn't lost.
function Action({ href, primary = false, icon, children }: { href: string; primary?: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      target="_blank"
      className={cn(
        "inline-flex items-center gap-2 rounded-[9px] border px-3 py-2 text-sm no-underline",
        primary
          ? "border-moss bg-moss text-white hover:bg-moss-strong hover:text-white"
          : "hairline bg-paper-raised text-ink hover:border-moss hover:text-ink",
      )}
    >
      {icon}
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </Link>
  );
}

// Plain text with /treks/<slug> and https links turned into anchors. React escapes everything else.
function Prose({ text }: { text: string }) {
  return (
    <div className="grid gap-3">
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i} className="whitespace-pre-line">
          {para.split(/(\/treks\/[a-z0-9-]+|https:\/\/[^\s)]+)/g).map((s, j) =>
            s.startsWith("/treks/") ? (
              <Link key={j} href={s} target="_blank">
                {s}
              </Link>
            ) : s.startsWith("https://") ? (
              <a key={j} href={s} target="_blank" rel="noopener noreferrer nofollow">
                {s}
              </a>
            ) : (
              <Fragment key={j}>{s}</Fragment>
            ),
          )}
        </p>
      ))}
    </div>
  );
}
