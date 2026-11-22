import { z } from "zod";
import { toMgdl, unitLabel, type GlucoseUnit } from "@/lib/units";

// Shared by the logging forms (instant feedback) and the server (final say).
// The server must re-check because offline sync means data can arrive hours
// later from a phone running an older version of the app.
//
// Three tiers (PLAN.md §5.2):
//   blocked  — physically impossible; can't be saved as entered
//   confirm  — unusual or a likely typo; ask "Did you mean…?" with a suggestion
//   ok       — save straight away
// "confirm" never hard-blocks a real value: a genuinely high reading is the
// most important one to record, so the user can always keep what they typed.

// ---------------------------------------------------------------------------
// Ranges. These are about TYPOS, not health: they are wider than any target
// and are never shown as "normal" (we never hardcode normal ranges).
// ---------------------------------------------------------------------------
export const BP_LIMITS = {
  // Outside these, a reading is almost certainly a typo or device error.
  usual: {
    systolic: [70, 250],
    diastolic: [40, 150],
    pulse: [35, 200],
  },
  // Outside these, it can't be a human blood pressure at all. The server
  // schema rejects them, so garbage can't enter via a buggy/old client.
  possible: {
    systolic: [40, 300],
    diastolic: [20, 200],
    pulse: [20, 250],
  },
} as const;

export const GLUCOSE_LIMITS_MGDL = {
  usual: [30, 600], // most home meters read "LO" below ~20 and "HI" above 600
  possible: [10, 1000],
  // Any mg/dL entry below this is far more likely a mmol/L number typed in
  // the wrong mode (5.6 rather than 101) than a real reading.
  unitSlipBelow: 35,
} as const;

// In mmol/L mode, meters top out at 33.3 mmol/L, so anything above 35 is
// almost certainly a mg/dL value.
const MMOL_UNIT_SLIP_ABOVE = 35;

export type CheckResult<T> =
  | { status: "ok"; value: T }
  | { status: "blocked"; message: string }
  | {
      status: "confirm";
      message: string;
      /** What we think they meant. Offered as the first, recommended button. */
      suggestion?: T;
      /** False when the entry as typed is impossible (e.g. swapped numbers). */
      allowAsEntered: boolean;
      value: T;
    };

export type BpValue = { systolic: number; diastolic: number; pulse?: number };

const inRange = (n: number, [lo, hi]: readonly [number, number]) =>
  n >= lo && n <= hi;

/**
 * A digit typed twice ("1200" for 120, "800" for 80) is the most common BP
 * typo on a phone keypad. Dividing by 10 recovers it when that lands in range.
 */
function fixExtraDigit(
  n: number,
  range: readonly [number, number],
): number | undefined {
  const fixed = Math.round(n / 10);
  return n > range[1] && inRange(fixed, range) ? fixed : undefined;
}

export function checkBp(input: BpValue): CheckResult<BpValue> {
  const { systolic, diastolic, pulse } = input;
  const nums = [systolic, diastolic, ...(pulse === undefined ? [] : [pulse])];

  if (nums.some((n) => !Number.isFinite(n) || n <= 0)) {
    return { status: "blocked", message: "Please enter whole numbers." };
  }

  const u = BP_LIMITS.usual;
  const sysFix = fixExtraDigit(systolic, u.systolic);
  const diaFix = fixExtraDigit(diastolic, u.diastolic);
  if (sysFix !== undefined || diaFix !== undefined) {
    const suggestion = {
      systolic: sysFix ?? systolic,
      diastolic: diaFix ?? diastolic,
      pulse,
    };
    if (suggestion.systolic > suggestion.diastolic) {
      return {
        status: "confirm",
        message: `That looks like a typo. Did you mean ${suggestion.systolic}/${suggestion.diastolic}?`,
        suggestion,
        allowAsEntered: isPossibleBp(input),
        value: input,
      };
    }
  }

  // Checked AFTER the extra-digit fix: "130/850" is a typo for 130/85, not
  // a swap, even though 850 > 130.
  //
  // Swapped fields: an easy slip with two boxes. Offer the swap rather than
  // an error. Keeping it as entered isn't allowed: top must be above bottom.
  if (diastolic > systolic) {
    return {
      status: "confirm",
      message: `The bottom number is bigger than the top number. Did you mean ${diastolic}/${systolic}?`,
      suggestion: { systolic: diastolic, diastolic: systolic, pulse },
      allowAsEntered: false,
      value: input,
    };
  }
  if (diastolic === systolic) {
    return {
      status: "blocked",
      message:
        "The top and bottom numbers can't be the same. Please check them.",
    };
  }

  if (!isPossibleBp(input)) {
    return {
      status: "blocked",
      message:
        "Those numbers can't be a blood pressure reading. Please check them.",
    };
  }

  if (
    !inRange(systolic, u.systolic) ||
    !inRange(diastolic, u.diastolic) ||
    (pulse !== undefined && !inRange(pulse, u.pulse))
  ) {
    return {
      status: "confirm",
      message: `${systolic}/${diastolic}${pulse !== undefined ? `, pulse ${pulse}` : ""} is unusual. Is that what your monitor shows?`,
      allowAsEntered: true,
      value: input,
    };
  }

  return { status: "ok", value: input };
}

function isPossibleBp({ systolic, diastolic, pulse }: BpValue): boolean {
  const p = BP_LIMITS.possible;
  return (
    inRange(systolic, p.systolic) &&
    inRange(diastolic, p.diastolic) &&
    systolic > diastolic &&
    (pulse === undefined || inRange(pulse, p.pulse))
  );
}

/** Result values for glucose are always in mg/dL, ready to store. */
export function checkGlucose(
  entered: number,
  unit: GlucoseUnit,
): CheckResult<number> {
  if (!Number.isFinite(entered) || entered <= 0) {
    return {
      status: "blocked",
      message: "Please enter the number from your meter.",
    };
  }

  const mgdl = toMgdl(entered, unit);
  const g = GLUCOSE_LIMITS_MGDL;

  // Unit slip, mg/dL mode: "5.6" was meant as mmol/L.
  if (unit === "mgdl" && entered < g.unitSlipBelow) {
    const asMgdl = toMgdl(entered, "mmol");
    return {
      status: "confirm",
      message: `${entered} ${unitLabel("mgdl")} is very low. Did you mean ${entered} ${unitLabel("mmol")} (${Math.round(asMgdl)} ${unitLabel("mgdl")})?`,
      suggestion: asMgdl,
      // Keep-as-entered stays available: a real reading of 30 mg/dL is rare
      // but serious, and must never be "corrected" away.
      allowAsEntered: mgdl >= g.possible[0],
      value: mgdl,
    };
  }

  // Unit slip, mmol/L mode: "101" was meant as mg/dL.
  if (unit === "mmol" && entered > MMOL_UNIT_SLIP_ABOVE) {
    return {
      status: "confirm",
      message: `${entered} ${unitLabel("mmol")} is higher than meters can read. Did you mean ${entered} ${unitLabel("mgdl")}?`,
      suggestion: toMgdl(entered, "mgdl"),
      allowAsEntered: false,
      value: mgdl,
    };
  }

  if (!inRange(mgdl, g.possible)) {
    return {
      status: "blocked",
      message: "That number can't be a blood sugar reading. Please check it.",
    };
  }

  if (!inRange(mgdl, g.usual)) {
    return {
      status: "confirm",
      message: "That reading is unusual. Is that what your meter shows?",
      allowAsEntered: true,
      value: mgdl,
    };
  }

  return { status: "ok", value: mgdl };
}

// ---------------------------------------------------------------------------
// Wire schemas: what the client sends to POST /api/sync. Shared so the outbox
// stores exactly what the server will accept.
// ---------------------------------------------------------------------------

export const GLUCOSE_CONTEXTS = [
  "fasting",
  "before_meal",
  "after_meal_2h",
  "bedtime",
  "random",
] as const;
export type GlucoseContext = (typeof GLUCOSE_CONTEXTS)[number];

const readingBase = {
  // Generated on the phone (crypto.randomUUID) so a retried sync upserts the
  // same record instead of creating a duplicate.
  id: z.uuid(),
  patientId: z.string().min(1),
  measuredAt: z.iso.datetime({ offset: true }),
  // Validated as a real IANA zone: a bad zone would break daily grouping.
  measuredTz: z.string().refine(isValidTimeZone, "Unknown timezone"),
  notes: z.string().trim().max(500).optional(),
};

const intIn = ([lo, hi]: readonly [number, number]) =>
  z.number().int().min(lo).max(hi);

export const bpReadingSchema = z
  .object({
    ...readingBase,
    type: z.literal("bp"),
    systolic: intIn(BP_LIMITS.possible.systolic),
    diastolic: intIn(BP_LIMITS.possible.diastolic),
    pulse: intIn(BP_LIMITS.possible.pulse).optional(),
  })
  .refine((r) => r.systolic > r.diastolic, {
    message: "Systolic must be higher than diastolic",
    path: ["diastolic"],
  });

export const glucoseReadingSchema = z.object({
  ...readingBase,
  type: z.literal("glucose"),
  valueMgdl: z
    .number()
    .min(GLUCOSE_LIMITS_MGDL.possible[0])
    .max(GLUCOSE_LIMITS_MGDL.possible[1]),
  context: z.enum(GLUCOSE_CONTEXTS),
});

export const readingSchema = z.discriminatedUnion("type", [
  bpReadingSchema,
  glucoseReadingSchema,
]);

export type BpReadingInput = z.infer<typeof bpReadingSchema>;
export type GlucoseReadingInput = z.infer<typeof glucoseReadingSchema>;
export type ReadingInput = z.infer<typeof readingSchema>;

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
