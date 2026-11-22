import Link from "next/link";
import type { LucideIcon } from "lucide-react";

// The main way into every logging flow. Sized well above the 56px minimum
// (DESIGN.md §2) because this is the button pressed every single day, often
// by someone with shaky hands or without glasses.
//
// It is a Link, not a <button>: each flow is its own URL, so the browser back
// button works as expected and routes can be prefetched for offline use.

type Props = {
  href: string;
  label: string;
  /** One short line under the label, e.g. "Top and bottom number". */
  hint?: string;
  icon: LucideIcon;
  variant?: "primary" | "secondary";
};

export function BigButton({
  href,
  label,
  hint,
  icon: Icon,
  variant = "primary",
}: Props) {
  const isPrimary = variant === "primary";

  return (
    <Link
      href={href}
      className={[
        "group flex min-h-24 w-full items-center gap-4 rounded-card px-5 py-4 transition-colors",
        isPrimary
          ? "bg-primary text-on-primary shadow-primary hover:bg-primary-hover"
          : // Secondary keeps a 2px red border rather than a grey one, so it
            // still reads as a button (not a card) to people who scan by shape.
            "border-2 border-primary bg-surface text-text shadow-card hover:bg-primary-soft",
      ].join(" ")}
    >
      <span
        aria-hidden
        className={[
          "flex size-14 shrink-0 items-center justify-center rounded-full",
          isPrimary ? "bg-on-primary/15" : "bg-primary-soft text-primary",
        ].join(" ")}
      >
        <Icon className="size-8" strokeWidth={2.25} />
      </span>

      <span className="flex flex-col text-left">
        <span className="text-title font-bold">{label}</span>
        {hint && (
          <span
            className={
              isPrimary
                ? "text-label text-on-primary"
                : "text-label text-text-muted"
            }
          >
            {hint}
          </span>
        )}
      </span>
    </Link>
  );
}
