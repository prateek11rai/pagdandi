"use client";

import { Download, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Only one intro plays at a time across the page.
let current: HTMLAudioElement | null = null;

function clock(s: number) {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export function AudioPlayer({
  src,
  title,
  compact = false,
  download = false,
}: {
  src: string;
  title: string;
  compact?: boolean;
  download?: boolean;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setTime(a.currentTime);
    const onMeta = () => setDuration(a.duration);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onPause);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onPause);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
    };
  }, []);

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      if (current && current !== a) current.pause();
      current = a;
      void a.play();
    } else {
      a.pause();
    }
  };

  const label = `${playing ? "Pause" : "Play"} audio intro: ${title}`;

  if (compact) {
    return (
      <>
        <audio ref={ref} src={src} preload="none" />
        <button
          type="button"
          onClick={toggle}
          aria-label={label}
          className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-ink/30 px-2.5 text-sm font-medium text-ink hover:bg-ink/5"
        >
          {playing ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
          {playing ? "Pause" : "Listen"}
        </button>
      </>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <audio ref={ref} src={src} preload="metadata" />
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-moss text-paper hover:bg-moss-strong"
      >
        {playing ? <Pause aria-hidden className="size-5" /> : <Play aria-hidden className="ml-0.5 size-5" />}
      </button>
      <div className="min-w-40 flex-1">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={1}
          value={time}
          aria-label="Seek"
          aria-valuetext={`${clock(time)} of ${clock(duration)}`}
          onChange={(e) => {
            if (ref.current) ref.current.currentTime = Number(e.target.value);
          }}
          className="w-full accent-saffron"
        />
        <div className="label mt-1 flex justify-between normal-case tracking-normal">
          <span>{clock(time)}</span>
          <span>{clock(duration)}</span>
        </div>
      </div>
      {download && (
        <a href={src} download className="inline-flex items-center gap-1.5 text-sm">
          <Download aria-hidden className="size-4" /> MP3
        </a>
      )}
    </div>
  );
}
