import type { LocalReading } from "@/lib/offline/db";
import { bpPeriod, formatTime } from "@/lib/readings/time";

// Pure helpers behind the Today screen, kept out of components so they can be
// unit-tested. These are DISPLAY helpers (what's done today, which reading is
// latest), not statistics. Averages and comparisons belong in lib/stats/ on
// the server, so the dashboard and PDF can never disagree (CLAUDE.md).

/** Calendar day key ("2026-11-22") in the timezone the reading was taken in. */
export function localDayKey(iso: string, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD, which sorts and compares as a string.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function localHour(iso: string, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso)),
  );
}

export type ChecklistItem = { id: string; label: string; doneAt?: string };

/**
 * Today's expected readings. Fixed for now (morning BP, fasting sugar,
 * evening BP, the standard home-monitoring routine); later driven by each
 * patient's reminder settings.
 */
export function todayChecklist(
  readings: LocalReading[],
  now: Date,
  timeZone: string,
): ChecklistItem[] {
  const today = localDayKey(now.toISOString(), timeZone);
  const todays = readings
    .filter((r) => localDayKey(r.measuredAt, r.measuredTz) === today)
    // oldest first, so "Done 7:42" shows the first reading of the slot
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));

  const firstBp = (period: "morning" | "evening") =>
    todays.find(
      (r) =>
        r.type === "bp" &&
        bpPeriod(localHour(r.measuredAt, r.measuredTz)) === period,
    );
  const fasting = todays.find(
    (r) => r.type === "glucose" && r.context === "fasting",
  );

  const item = (
    id: string,
    label: string,
    r?: LocalReading,
  ): ChecklistItem => ({
    id,
    label,
    ...(r && { doneAt: formatTime(r.measuredAt) }),
  });

  return [
    item("bp_am", "Morning blood pressure", firstBp("morning")),
    item("glucose_fasting", "Blood sugar (fasting)", fasting),
    item("bp_pm", "Evening blood pressure", firstBp("evening")),
  ];
}

/** "This morning, 7:42" / "Yesterday, 19:05" / "Fri 20 Nov, 7:00". */
export function describeWhen(iso: string, timeZone: string, now: Date): string {
  const day = localDayKey(iso, timeZone);
  const today = localDayKey(now.toISOString(), timeZone);
  const yesterday = localDayKey(
    new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    timeZone,
  );
  const time = new Date(iso).toLocaleTimeString(undefined, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
  if (day === today) {
    const p = bpPeriod(localHour(iso, timeZone));
    const label =
      p === "morning"
        ? "This morning"
        : p === "afternoon"
          ? "This afternoon"
          : p === "evening"
            ? "This evening"
            : "Last night";
    return `${label}, ${time}`;
  }
  if (day === yesterday) return `Yesterday, ${time}`;
  const date = new Date(iso).toLocaleDateString(undefined, {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${date}, ${time}`;
}
