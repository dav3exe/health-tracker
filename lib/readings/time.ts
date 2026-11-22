import type { GlucoseContext } from "@/lib/validation/readings";

// Time-of-day rules in one place, so the logging form, the Today checklist and
// the stats (morning vs evening BP) all agree on what "morning" means.
// PLAN.md §5.3: morning = 04:00–11:59, evening = 17:00–23:59 local time.

export type BpPeriod = "morning" | "afternoon" | "evening" | "night";

export function bpPeriod(hour: number): BpPeriod {
  if (hour >= 4 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17) return "evening";
  return "night";
}

export const BP_PERIOD_LABEL: Record<BpPeriod, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

// A sensible default chip so most people never have to change it. Early
// morning is usually the fasting check; late night is the bedtime check.
// Anything else defaults to "Other" rather than guessing about meals,
// because a wrong "after meal" label would skew the fasting vs post-meal stats.
export function defaultGlucoseContext(hour: number): GlucoseContext {
  if (hour >= 4 && hour < 9) return "fasting";
  if (hour >= 21 || hour < 4) return "bedtime";
  return "random";
}

// Plain-language chip labels (DESIGN.md §7), in the order shown.
export const GLUCOSE_CONTEXT_LABEL: Record<GlucoseContext, string> = {
  fasting: "Fasting",
  before_meal: "Before meal",
  after_meal_2h: "2 hours after meal",
  bedtime: "Bedtime",
  random: "Other",
};

/** The device's IANA timezone, stored with every reading. */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * ISO 8601 with the device's UTC offset, e.g. "2026-11-22T07:42:00+01:00".
 * Keeping the offset (not just "Z") means a reading is still unambiguous and
 * human-checkable if it ever needs debugging; the server stores it as UTC.
 */
export function toIsoWithOffset(d: Date): string {
  const pad = (n: number) => String(Math.abs(n)).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`
  );
}

/** "7:42" in the device's locale, for confirmations and lists. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
