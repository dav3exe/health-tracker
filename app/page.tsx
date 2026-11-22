import { Suspense } from "react";
import Link from "next/link";
import { Droplet, HeartPulse, Settings } from "lucide-react";
import { BigButton } from "@/components/ui/BigButton";
import { SyncStatus } from "@/components/ui/SyncStatus";
import { Greeting, GreetingFallback } from "@/components/today/Greeting";
import {
  TodayChecklist,
  type ChecklistItem,
} from "@/components/today/TodayChecklist";
import { BottomNav } from "@/components/nav/BottomNav";

// The "Today" screen: the home screen and the start of the 10-second logging
// path (PLAN.md §5.2). Order matters: the two big logging buttons come first,
// above the fold on the smallest phones, because logging is why the app is
// opened 95% of the time. The checklist comes second, as reassurance.

// MILESTONE 0 PLACEHOLDER: static sample data so the design can be reviewed.
// Milestone 1 replaces this with today's real readings for the selected
// patient, fetched through lib/db/ (never directly from here).
const sampleChecklist: ChecklistItem[] = [
  { id: "bp_am", label: "Morning blood pressure", doneAt: "7:42" },
  { id: "glucose_fasting", label: "Blood sugar (fasting)" },
  { id: "bp_pm", label: "Evening blood pressure" },
];

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

        <TodayChecklist items={sampleChecklist} />

        <SyncStatus />
      </main>

      <BottomNav />
    </>
  );
}
