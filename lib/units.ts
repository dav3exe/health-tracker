// The ONE place glucose units are converted (CLAUDE.md hard rule). Forms, the
// dashboard and the PDF all import from here, so a rounding rule can never
// differ between what the patient typed and what the doctor reads.
//
// Storage is always mg/dL. Mixing units in the database would corrupt every
// average and trend, and mg/dL is a whole-ish number that survives rounding
// better than mmol/L's single decimal.

export type GlucoseUnit = "mgdl" | "mmol";

// Spec value (PLAN.md §4). The precise molar factor is 18.016; the difference
// is under 0.1% and 18.0 is what meters and clinicians use in practice, so
// numbers in the app match the numbers on the patient's meter.
export const MGDL_PER_MMOL = 18.0;

/** Round to one decimal place, the precision we store (numeric 5,1). */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function mmolToMgdl(mmol: number): number {
  return round1(mmol * MGDL_PER_MMOL);
}

export function mgdlToMmol(mgdl: number): number {
  return round1(mgdl / MGDL_PER_MMOL);
}

/** Convert whatever the user typed into the canonical stored unit. */
export function toMgdl(value: number, unit: GlucoseUnit): number {
  return unit === "mmol" ? mmolToMgdl(value) : round1(value);
}

/** Convert a stored value to the patient's display unit. */
export function fromMgdl(mgdl: number, unit: GlucoseUnit): number {
  // mg/dL is shown as a whole number, like on meters; mmol/L keeps 1 decimal.
  return unit === "mmol" ? mgdlToMmol(mgdl) : Math.round(mgdl);
}

export function unitLabel(unit: GlucoseUnit): string {
  return unit === "mmol" ? "mmol/L" : "mg/dL";
}

/** e.g. "101 mg/dL" or "5.6 mmol/L". */
export function formatGlucose(mgdl: number, unit: GlucoseUnit): string {
  const value = fromMgdl(mgdl, unit);
  const text = unit === "mmol" ? value.toFixed(1) : String(value);
  return `${text} ${unitLabel(unit)}`;
}
