"use client";

import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ABOUT, isActive, MODEL_LINE, NAV, startNewPlan } from "./nav";

const tab = "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium no-underline";

// Below the shell breakpoint the sidebar becomes this bar; About and the model line sit behind "More".
export function TabBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [open]);

  const aboutActive = isActive(pathname, ABOUT.href);
  return (
    <div ref={ref} className="no-print fixed inset-x-0 bottom-0 z-30 border-t hairline bg-paper pb-[env(safe-area-inset-bottom)] shell:hidden">
      {open && (
        <div id="more-menu" className="absolute bottom-full right-2 mb-2 w-64 rounded-xl border hairline bg-paper-raised p-2 shadow-lg">
          <Link
            href={ABOUT.href}
            aria-current={aboutActive ? "page" : undefined}
            className="flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 font-medium text-ink no-underline hover:bg-paper"
          >
            <ABOUT.icon aria-hidden strokeWidth={1.75} className="size-[18px] text-ink-muted" />
            {ABOUT.label}
          </Link>
          <p className="px-2.5 pb-1 pt-2 text-xs leading-snug text-ink-muted">{MODEL_LINE}</p>
        </div>
      )}
      <nav aria-label="Main" className="flex h-16">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={() => startNewPlan(pathname, item.href)}
              className={cn(tab, active ? "text-moss" : "text-ink-muted")}
            >
              <item.icon aria-hidden strokeWidth={1.75} className="size-[18px]" />
              {item.short}
            </Link>
          );
        })}
        <button
          type="button"
          aria-expanded={open}
          aria-controls="more-menu"
          onClick={() => setOpen((o) => !o)}
          className={cn(tab, open || aboutActive ? "text-moss" : "text-ink-muted")}
        >
          <Ellipsis aria-hidden strokeWidth={1.75} className="size-[18px]" />
          More
        </button>
      </nav>
    </div>
  );
}
