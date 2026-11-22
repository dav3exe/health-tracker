"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CloudUpload,
  Droplet,
  HeartPulse,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { LocalReading } from "@/lib/offline/db";
import { useDeviceSettings, useReadings } from "@/lib/offline/hooks";
import { undoReading } from "@/lib/offline/outbox";
import { GLUCOSE_CONTEXT_LABEL } from "@/lib/readings/time";
import { describeWhen, localDayKey } from "@/lib/readings/today";
import { formatGlucose } from "@/lib/units";

// Every reading, newest first, grouped by day (DESIGN.md §5.5). Read straight
// from the phone, so History works offline and shows readings that haven't
// synced yet, labelled honestly as such.

export function HistoryList() {
  const settings = useDeviceSettings();
  const readings = useReadings(settings.activePatientId);
  const [toDelete, setToDelete] = useState<LocalReading | null>(null);

  if (readings === undefined) {
    return <div aria-hidden className="h-64 rounded-card bg-surface-muted" />;
  }

  if (readings.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-card border border-border-subtle bg-surface p-6 shadow-card">
        <p className="text-body font-bold">No readings yet</p>
        <p className="text-body text-text-muted">
          Your readings will appear here after you save them.
        </p>
        <Button asChild size="lg">
          <Link href="/log/bp">Add blood pressure</Link>
        </Button>
      </div>
    );
  }

  // Group by the calendar day the reading was TAKEN on, in its own timezone.
  const groups = new Map<string, LocalReading[]>();
  for (const r of readings) {
    const key = localDayKey(r.measuredAt, r.measuredTz);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const now = new Date();

  return (
    <>
      <div className="flex flex-col gap-6">
        {[...groups.entries()].map(([day, rows]) => (
          <section key={day} aria-label={dayHeading(rows[0], now)}>
            <h2 className="mb-2 text-label font-bold text-text-muted">
              {dayHeading(rows[0], now)}
            </h2>
            <ul className="divide-y divide-border-subtle rounded-card border border-border-subtle bg-surface shadow-card">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center gap-4 px-4 py-3">
                  <ReadingIcon reading={r} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="tabular text-title font-bold">
                      {primaryText(r, settings.glucoseUnit)}
                    </span>
                    <span className="text-label text-text-muted">
                      {secondaryText(r)}
                    </span>
                    <SyncNote reading={r} />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete reading ${primaryText(r, settings.glucoseUnit)}`}
                    onClick={() => setToDelete(r)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Delete is the one place we DO confirm first: unlike right after
          saving, there's no Undo bar here, and a reading deleted by a stray
          tap could be one the doctor needed. */}
      <AlertDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this reading?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete &&
                `${primaryText(toDelete, settings.glucoseUnit)}, ${secondaryText(toDelete)}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setToDelete(null)}
            >
              Keep it
            </Button>
            <Button
              size="lg"
              variant="destructive"
              onClick={async () => {
                if (toDelete) await undoReading(toDelete.id);
                setToDelete(null);
              }}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function dayHeading(r: LocalReading, now: Date): string {
  // Reuse describeWhen's "Yesterday"/date logic, dropping the time part.
  const when = describeWhen(r.measuredAt, r.measuredTz, now);
  if (when.startsWith("This") || when.startsWith("Last night")) return "Today";
  return when.slice(0, when.lastIndexOf(","));
}

function primaryText(r: LocalReading, unit: "mgdl" | "mmol"): string {
  return r.type === "bp"
    ? `${r.systolic}/${r.diastolic}`
    : formatGlucose(r.valueMgdl, unit);
}

function secondaryText(r: LocalReading): string {
  const time = new Date(r.measuredAt).toLocaleTimeString(undefined, {
    timeZone: r.measuredTz,
    hour: "numeric",
    minute: "2-digit",
  });
  if (r.type === "bp") {
    return [
      "Blood pressure",
      r.pulse !== undefined ? `pulse ${r.pulse}` : null,
      time,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return `Blood sugar · ${GLUCOSE_CONTEXT_LABEL[r.context]} · ${time}`;
}

function ReadingIcon({ reading }: { reading: LocalReading }) {
  const Icon = reading.type === "bp" ? HeartPulse : Droplet;
  return (
    <span
      aria-hidden
      className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
    >
      <Icon className="size-6" />
    </span>
  );
}

// Sync state in words. "Waiting to sync" is calm (it's safe on the phone);
// "Not saved" is the only alarming state, and it says why.
function SyncNote({ reading }: { reading: LocalReading }) {
  if (reading.syncState === "pending") {
    return (
      <span className="mt-1 flex items-center gap-1.5 text-small text-text-muted">
        <CloudUpload aria-hidden className="size-4" />
        On this phone, waiting to sync
      </span>
    );
  }
  if (reading.syncState === "rejected") {
    return (
      <span className="mt-1 flex items-center gap-1.5 text-small font-bold text-flag">
        <TriangleAlert aria-hidden className="size-4" />
        Not saved to your account: {reading.rejectReason}
      </span>
    );
  }
  return null;
}
