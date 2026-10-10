import Link from "next/link";
import { Footprints } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/", label: "Treks" },
  { href: "/ask", label: "Ask" },
  { href: "/updates", label: "Updates" },
  { href: "/about", label: "About" },
];

export function Logotype() {
  return (
    <span className="inline-flex items-baseline gap-2">
      <Footprints aria-hidden className="size-6 self-center text-moss" strokeWidth={1.75} />
      <span className="font-serif text-2xl font-semibold tracking-tight">Pagdandi</span>
      <span lang="hi" className="font-devanagari text-lg text-ink-muted">
        पगडंडी
      </span>
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="no-print border-b hairline">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="text-ink no-underline hover:text-ink" aria-label="Pagdandi, home">
          <Logotype />
        </Link>
        <nav aria-label="Main" className="order-last w-full sm:order-none sm:w-auto">
          <ul className="flex gap-5 text-base">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="text-ink no-underline hover:text-moss">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
