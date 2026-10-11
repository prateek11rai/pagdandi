"use client";

import { Info, Mail, MessageSquarePlus, Mountain, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";

export const MODEL_LINE = "Runs on Gemma 4, hosted by us. Chats aren't stored.";
// The New plan page listens for this to start over when you're already on it.
export const NEW_PLAN_EVENT = "pagdandi:new-plan";

interface NavItem {
  href: string;
  label: string;
  short: string; // tab bar label
  icon: LucideIcon;
  soon?: boolean;
}

export const NAV: NavItem[] = [
  { href: "/", label: "New plan", short: "New plan", icon: MessageSquarePlus },
  { href: "/treks", label: "Treks", short: "Treks", icon: Mountain },
  { href: "/updates", label: "Daily updates", short: "Updates", icon: Mail, soon: true },
];
export const ABOUT: NavItem = { href: "/about", label: "About and data", short: "About", icon: Info };

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function startNewPlan(pathname: string, href: string) {
  if (href === "/" && pathname === "/") window.dispatchEvent(new Event(NEW_PLAN_EVENT));
}

export function Logotype() {
  return (
    <span className="inline-flex items-center gap-2">
      <Image src="/brand/logo.svg" alt="" width={24} height={24} unoptimized />
      <span className="font-serif text-[23px] font-bold leading-none text-moss">Pagdandi</span>
      <span lang="hi" className="mt-[3px] font-serif text-lg leading-none text-clay">
        पगडंडी
      </span>
    </span>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={() => startNewPlan(pathname, item.href)}
      className={cn(
        "flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 font-medium text-ink no-underline hover:bg-paper-raised hover:text-ink",
        active && "bg-paper-raised text-moss hover:text-moss",
      )}
    >
      <Icon aria-hidden strokeWidth={1.75} className={cn("size-[18px] shrink-0", active ? "text-moss" : "text-ink-muted")} />
      {item.label}
      {item.soon && (
        <Badge variant="highlight" className="ml-auto h-[18px] text-[10px]">
          coming soon
        </Badge>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r hairline bg-paper px-3 py-[18px] shell:flex">
      <Link href="/" aria-label="Pagdandi, new plan" className="px-2.5 pb-5 pt-1.5 no-underline" onClick={() => startNewPlan(pathname, "/")}>
        <Logotype />
      </Link>
      <nav aria-label="Main" className="grid gap-0.5">
        {NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>
      <div className="mt-auto border-t hairline pt-2.5">
        <NavLink item={ABOUT} pathname={pathname} />
        <p className="px-2.5 pt-2 text-xs leading-snug text-ink-muted">{MODEL_LINE}</p>
      </div>
    </aside>
  );
}
