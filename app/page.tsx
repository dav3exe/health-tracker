import { Suspense } from "react";
import Link from "next/link";
import { Droplet, HeartPulse, Settings } from "lucide-react";
import { BigButton } from "@/components/ui/BigButton";
import { Greeting, GreetingFallback } from "@/components/today/Greeting";
import { TodayLive } from "@/components/today/TodayLive";
import { ClientOnly } from "@/components/providers/ClientOnly";
import { BottomNav } from "@/components/nav/BottomNav";

// The "Today" screen: the home screen and the start of the 10-second logging
// path (PLAN.md §5.2). Order matters: the two big logging buttons come first,
// above the fold on the smallest phones, because logging is why the app is
// opened 95% of the time. The checklist comes second, as reassurance.
//
// The buttons are static and render instantly from the prerendered shell.
// Only the live part (checklist, latest reading, sync status) waits for the
// phone's database, so the screen is usable immediately.

export default function TodayPage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-6 pb-8">
        <header className="flex items-start justify-between gap-4">
          <Suspense fallback={<GreetingFallback />}>
            <Greeting />
          </Suspense>
          <Link
            href="/settings"
            aria-label="Settings"
            className="flex size-14 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted"
          >
            <Settings aria-hidden className="size-7" />
          </Link>
        </header>

        <div className="flex flex-col gap-4">
          {/* Plain words first ("Blood pressure"), not medical terms. The
              hint line tells first-time users exactly what they'll enter. */}
          <BigButton
            href="/log/bp"
            label="Blood pressure"
            hint="Top number, bottom number, pulse"
            icon={HeartPulse}
          />
          <BigButton
            href="/log/glucose"
            label="Blood sugar"
            hint="One number from your meter"
            icon={Droplet}
            variant="secondary"
          />
        </div>

        <ClientOnly
          fallback={
            // Same footprint as the checklist card, so nothing jumps.
            <div
              aria-hidden
              className="h-80 rounded-card border border-border-subtle bg-surface-muted"
            />
          }
        >
          <TodayLive />
        </ClientOnly>
      </main>

      <BottomNav />
    </>
  );
}
