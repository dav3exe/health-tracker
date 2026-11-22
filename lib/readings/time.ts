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
