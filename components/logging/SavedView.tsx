"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CircleCheck, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePendingCount } from "@/lib/offline/hooks";

// The "Saved ✓" moment (DESIGN.md §5.4). Repeating the number back in huge
// type lets the user catch a mistake at a glance, and the Undo button makes
// fixing it one tap. That's why the form never asks "Are you sure?" first.

const UNDO_SECONDS = 10;

type Props = {
  /** Big value line, e.g. "128/82" or "101". */
  value: string;
  unit: string;
  /** Second line, e.g. "Pulse 71 · Morning, 7:42". */
  detail: string;
  onUndo: () => void;
};

export function SavedView({ value, unit, detail, onUndo }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(UNDO_SECONDS);
  const pending = usePendingCount();
  const doneRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // Move focus to the confirmation so screen readers announce it and
    // keyboard users land on "Done" rather than a field that's gone.
    doneRef.current?.focus();
    const t = setInterval(
      () => setSecondsLeft((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div
        role="status"
        className="flex flex-col items-center gap-4 rounded-card bg-primary-soft px-5 py-10 text-center"
      >
        <span className="flex size-16 items-center justify-center rounded-full bg-primary text-on-primary">
          <CircleCheck aria-hidden className="size-10" strokeWidth={2.5} />
        </span>
        <p className="text-title font-bold">Saved</p>
        <p className="flex items-baseline gap-2">
          <span className="tabular text-hero font-bold">{value}</span>
          <span className="text-label text-text-muted">{unit}</span>
        </p>
        <p className="text-body text-text-muted">{detail}</p>
        <p className="text-label text-text-muted">
          {pending > 0
            ? "Saved on this phone. It will sync when you're online."
            : "Saved to your account."}
        </p>
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <Button asChild size="lg">
          <Link ref={doneRef} href="/">
            Done
          </Link>
        </Button>
        {/* Undo stays visible for 10 s; after that the reading can still be
            removed from History, so nothing is ever permanent by accident. */}
        {secondsLeft > 0 && (
          <Button size="lg" variant="outline" onClick={onUndo}>
            <Undo2 aria-hidden />
            Undo ({secondsLeft})
          </Button>
        )}
      </div>
    </div>
  );
}
