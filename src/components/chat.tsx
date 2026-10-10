"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { AlertTriangle, ArrowUp, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";
import type { TrekCard as TrekCardData } from "@/lib/treks";
import { TrekCard } from "./trek-card";
import { Button } from "./ui/button";

const MAX_CHARS = 500;
const STARTERS = [
  "5 of us, 2 first-timers, ₹12k each, 4 days in December, from Delhi",
  "A one-day hike near Mumbai after the monsoon",
  "Which trek has the best views without going too high?",
];

interface RecommendOutput {
  cards: TrekCardData[];
  reasons: Record<string, string>;
}

export function Chat() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const busy = status === "submitted" || status === "streaming";

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    void sendMessage({ text: t.slice(0, MAX_CHARS) });
    setInput("");
  };

  return (
    <div className="grid gap-6">
      {messages.length === 0 && (
        <div>
          <p className="label">Try one of these</p>
          <ul className="mt-2 grid gap-2">
            {STARTERS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => send(s)}
                  className="w-full rounded-sm border border-ink/25 px-3 py-2 text-left hover:bg-ink/5"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ol className="grid gap-8" aria-live="polite">
        {messages.map((m) => (
          <li key={m.id}>
            <Message message={m} />
          </li>
        ))}
      </ol>

      {busy && (
        <p className="flex items-center gap-2 text-sm text-ink-muted" role="status">
          <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
          The guide runs on our own server, so answers take a few seconds.
        </p>
      )}
      {error && (
        <p className="text-sm text-clay-ink" role="alert">
          The trek guide is having trouble right now. Please try again in a minute.
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-0 border-t hairline bg-paper pb-4 pt-3"
      >
        <label htmlFor="ask" className="label">
          Ask about treks for your group
        </label>
        <div className="mt-1.5 flex items-end gap-2">
          <textarea
            id="ask"
            rows={2}
            maxLength={MAX_CHARS}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="How many of you, budget each, days, month, where from"
            className="min-h-11 w-full resize-y rounded-sm border border-ink/30 bg-paper-raised px-3 py-2 text-base"
          />
          <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send">
            <ArrowUp aria-hidden />
          </Button>
        </div>
        <p className="mt-1 text-right text-xs text-ink-muted">
          {input.length}/{MAX_CHARS} · Chats are not stored.
        </p>
      </form>
    </div>
  );
}

function Message({ message }: { message: UIMessage }) {
  if (message.role === "user") {
    const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    return (
      <div>
        <p className="label">You asked</p>
        <p className="mt-1 font-serif text-lg italic">{text}</p>
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      {message.parts.map((p, i) => {
        if (p.type === "text") return <Prose key={i} text={p.text} />;
        if (p.type === "tool-searchTreks" && p.state !== "output-available") {
          return (
            <p key={i} className="text-sm text-ink-muted">
              Looking through the treks…
            </p>
          );
        }
        if (p.type === "tool-recommendTreks" && p.state === "output-available") {
          return <Recommendations key={i} output={p.output as RecommendOutput} />;
        }
        return null;
      })}
    </div>
  );
}

function Recommendations({ output }: { output: RecommendOutput }) {
  const high = output.cards.filter((c) => (c.highestAltitudeM ?? 0) > 3500);
  return (
    <div className="grid gap-4">
      <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
        {output.cards.map((c) => (
          <li key={c.slug}>
            <TrekCard trek={c} reason={output.reasons[c.slug]} />
          </li>
        ))}
      </ul>
      {high.length > 0 && (
        <aside className="flex gap-3 border-l-4 border-clay bg-paper-raised p-3 text-sm" aria-label="Altitude safety">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-clay" />
          <p>
            {high.map((c) => c.name).join(" and ")} {high.length === 1 ? "goes" : "go"} above 3,500 m. Climb slowly and
            read the safety note on the trek page. This is not medical advice and not a substitute for a licensed local
            guide.
          </p>
        </aside>
      )}
    </div>
  );
}

// Plain text with /treks/<slug> and https links turned into anchors. React escapes everything else.
function Prose({ text }: { text: string }) {
  const parts = text.split(/(\/treks\/[a-z0-9-]+|https:\/\/[^\s)]+)/g);
  return (
    <p className="whitespace-pre-line">
      {parts.map((s, i) =>
        s.startsWith("/treks/") ? (
          <Link key={i} href={s}>
            {s}
          </Link>
        ) : s.startsWith("https://") ? (
          <a key={i} href={s} rel="noopener noreferrer nofollow">
            {s}
          </a>
        ) : (
          <Fragment key={i}>{s}</Fragment>
        ),
      )}
    </p>
  );
}
