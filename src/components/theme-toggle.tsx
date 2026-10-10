"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "./ui/button";

type Theme = "light" | "dark";

// The theme lives on <html data-theme>, set before paint by the inline script in the layout.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const current = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, current, () => null);
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Switch to ${next} theme`}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("theme", next);
        } catch {}
      }}
    >
      {theme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}
