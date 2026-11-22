"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartLine, House, List } from "lucide-react";

// Three tabs maximum in simple mode (DESIGN.md §5.1). Every tab shows a text
// label: icon-only navigation is a guessing game for people new to apps.
// Placed at the bottom because that's where thumbs reach on large phones.

const tabs = [
  { href: "/", label: "Today", icon: House },
  { href: "/history", label: "History", icon: List },
  { href: "/trends", label: "Trends", icon: ChartLine },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 border-t border-border-subtle bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-xl">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={[
                  "relative flex min-h-18 flex-col items-center justify-center gap-1 text-label",
                  active ? "font-bold text-primary" : "text-text-muted",
                ].join(" ")}
              >
                {/* Active tab gets a red bar as well as colour and bold text,
                    so it's identifiable without colour vision. */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-6 top-0 h-1 rounded-b-full bg-primary"
                  />
                )}
                <Icon
                  aria-hidden
                  className="size-7"
                  strokeWidth={active ? 2.5 : 2}
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
