"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export const MAX_CHARS = 500;

// The message box: Enter sends, Shift+Enter adds a line.
export function Composer({
  label,
  placeholder,
  meta,
  disabled = false,
  focusOnMount = false,
  onSend,
}: {
  label: string;
  placeholder: string;
  meta: string;
  disabled?: boolean;
  focusOnMount?: boolean;
  onSend: (text: string) => void;
}) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);

  const submit = () => {
    if (disabled || !value.trim()) return;
    onSend(value);
    setValue("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="rounded-xl border hairline bg-paper-raised px-4 pb-3 pt-4 shadow-[0_1px_0_rgba(0,0,0,0.03)] focus-within:border-moss focus-within:ring-2 focus-within:ring-moss/25"
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <textarea
        id={id}
        ref={ref}
        rows={2}
        maxLength={MAX_CHARS}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        className="block max-h-48 min-h-[54px] w-full resize-none bg-transparent text-[17px] leading-normal text-ink outline-none [field-sizing:content] placeholder:text-ink-faint"
      />
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <span className="text-[13px] leading-snug text-ink-muted">{meta}</span>
        <button
          type="submit"
          aria-label="Send"
          disabled={disabled || !value.trim()}
          className="grid size-[38px] shrink-0 place-items-center rounded-[9px] bg-moss text-white hover:bg-moss-strong disabled:opacity-50"
        >
          <ArrowUp aria-hidden strokeWidth={2} className="size-[18px]" />
        </button>
      </div>
    </form>
  );
}
