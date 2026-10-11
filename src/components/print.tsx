"use client";

import { Printer } from "lucide-react";
import { useEffect } from "react";

export function PrintButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      <Printer aria-hidden strokeWidth={1.75} className="size-4" />
      Print the one-page plan
    </button>
  );
}

// "Print the one-page plan" in the guide links here with ?print=1: open the print dialog once the fonts are in.
export function AutoPrint() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("print") !== "1") return;
    url.searchParams.delete("print");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    let cancelled = false;
    void document.fonts.ready.then(() => !cancelled && window.print());
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
