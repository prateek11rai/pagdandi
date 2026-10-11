"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Only one intro plays at a time across the page.
let current: HTMLAudioElement | null = null;

export function clock(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

// "mini" for table rows: a 28 px button, a thin bar and the time. "full" for the trek page: a 40 px button
// and a bar you can seek with. The bar's width is set through a ref, not a style attribute, so the strict
// CSP (no inline styles) holds.
export function AudioPlayer({ src, title, size = "mini" }: { src: string; title: string; size?: "mini" | "full" }) {
  const audio = useRef<HTMLAudioElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(Number.NaN);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const onTime = () => {
      setTime(a.currentTime);
      if (fill.current && a.duration) fill.current.style.width = `${(a.currentTime / a.duration) * 100}%`;
    };
    const onMeta = () => setDuration(a.duration);
    const onPlay = () => {
      setPlaying(true);
      setStarted(true);
    };
    const onPause = () => setPlaying(false);
    if (a.readyState >= 1) onMeta();
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onPause);
    return () => {
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onPause);
    };
  }, []);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) {
      if (current && current !== a) current.pause();
      current = a;
      void a.play();
    } else {
      a.pause();
    }
  };

  const full = size === "full";
  const total = Number.isFinite(duration) ? clock(duration) : "–:––";
  const label = `${playing ? "Pause" : "Play"} the audio intro: ${title}`;
  const Icon = playing ? Pause : Play;

  return (
    <span
      className={cn(
        "relative z-10 inline-flex items-center",
        full ? "w-full max-w-[460px] gap-3 rounded-[10px] border border-rule bg-paper-raised px-3 py-2.5" : "min-w-[150px] gap-2",
      )}
    >
      <audio ref={audio} src={src} preload="metadata" />
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        className={cn(
          "grid shrink-0 place-items-center rounded-full border border-moss bg-paper-raised text-moss hover:bg-paper",
          full ? "size-10" : "size-7",
        )}
      >
        <Icon aria-hidden fill="currentColor" strokeWidth={0} className={full ? "size-3.5" : "size-3"} />
      </button>
      <span className="relative h-[3px] flex-1 rounded-sm bg-ink/15 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-4 has-[input:focus-visible]:outline-ink">
        <span ref={fill} className="absolute inset-y-0 left-0 w-0 rounded-sm bg-moss" />
        {full && (
          <input
            type="range"
            min={0}
            max={Number.isFinite(duration) ? Math.floor(duration) : 0}
            step={1}
            value={Math.floor(time)}
            aria-label={`Seek in the audio intro: ${title}`}
            aria-valuetext={`${clock(time)} of ${total}`}
            onChange={(e) => {
              if (audio.current) audio.current.currentTime = Number(e.target.value);
            }}
            className="absolute -inset-y-2 inset-x-0 w-full cursor-pointer opacity-0"
          />
        )}
      </span>
      <span className={cn("whitespace-nowrap tabular-nums", full ? "text-[13px]" : "text-xs", playing ? "text-ink" : "text-ink-muted")}>
        {full || started ? `${clock(time)} / ${total}` : total}
      </span>
    </span>
  );
}
