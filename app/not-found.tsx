import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// A friendly dead end. "404" means nothing to most people, and to an older
// user a technical error page reads as "I broke it". Say what happened in
// plain words and offer one big way back (DESIGN.md §7).
//
// During early milestones this also catches screens that aren't built yet.

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-title font-bold">This page isn&rsquo;t here</h1>
        <p className="text-body text-text-muted">
          It may not be ready yet, or the link is old. Your readings are safe.
        </p>
      </div>
      <Link
        href="/"
        className="flex min-h-16 items-center justify-center gap-3 rounded-button bg-primary px-6 text-body font-bold text-on-primary shadow-primary hover:bg-primary-hover"
      >
        <ArrowLeft aria-hidden className="size-6" />
        Back to Today
      </Link>
    </main>
  );
}
