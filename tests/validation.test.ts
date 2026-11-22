import { describe, expect, it } from "vitest";
import {
  bpReadingSchema,
  checkBp,
  checkGlucose,
  readingSchema,
} from "@/lib/validation/readings";
import {
  formatGlucose,
  fromMgdl,
  mgdlToMmol,
  mmolToMgdl,
  toMgdl,
} from "@/lib/units";
import { bpPeriod, defaultGlucoseContext } from "@/lib/readings/time";

describe("units", () => {
  it("converts with the spec factor 18.0", () => {
    expect(mmolToMgdl(5.6)).toBe(100.8);
    expect(mgdlToMmol(100.8)).toBe(5.6);
    expect(toMgdl(7, "mmol")).toBe(126);
  });

  it("round-trips a typed mmol value without drift", () => {
    for (const mmol of [3.9, 5.5, 7.8, 11.1, 22.2]) {
      expect(fromMgdl(toMgdl(mmol, "mmol"), "mmol")).toBe(mmol);
    }
  });

  it("formats for display", () => {
    expect(formatGlucose(100.8, "mgdl")).toBe("101 mg/dL");
    expect(formatGlucose(100.8, "mmol")).toBe("5.6 mmol/L");
  });
});

describe("checkBp", () => {
  it.each([
    [{ systolic: 120, diastolic: 80 }],
    [{ systolic: 135, diastolic: 88, pulse: 72 }],
  ])("accepts a normal-looking entry %o", (v) => {
    expect(checkBp(v).status).toBe("ok");
  });

  it("suggests 120/80 for the classic 1200/80 typo", () => {
    const r = checkBp({ systolic: 1200, diastolic: 80 });
    expect(r.status).toBe("confirm");
    if (r.status === "confirm") {
      expect(r.suggestion).toMatchObject({ systolic: 120, diastolic: 80 });
      expect(r.allowAsEntered).toBe(false); // 1200 is impossible
      expect(r.message).toContain("120/80");
    }
  });

  it("suggests a fix for a doubled digit in the bottom number", () => {
    const r = checkBp({ systolic: 130, diastolic: 850 });
    expect(r.status === "confirm" && r.suggestion).toMatchObject({
      systolic: 130,
      diastolic: 85,
    });
  });

  it("offers to swap when the bottom number is bigger", () => {
    const r = checkBp({ systolic: 80, diastolic: 120 });
    expect(r.status).toBe("confirm");
    if (r.status === "confirm") {
      expect(r.suggestion).toMatchObject({ systolic: 120, diastolic: 80 });
      expect(r.allowAsEntered).toBe(false);
    }
  });

  it("asks (but allows) a genuinely high reading", () => {
    // A real hypertensive reading must never be blocked: it's the one that
    // matters most. It's confirmed, and saving as entered stays possible.
    const r = checkBp({ systolic: 260, diastolic: 130 });
    expect(r.status).toBe("confirm");
    if (r.status === "confirm") expect(r.allowAsEntered).toBe(true);
  });

  it("asks about an unusual pulse", () => {
    expect(checkBp({ systolic: 120, diastolic: 80, pulse: 30 }).status).toBe(
      "confirm",
    );
  });

  it.each([
    [{ systolic: 0, diastolic: 80 }],
    [{ systolic: 120, diastolic: 120 }],
    [{ systolic: Number.NaN, diastolic: 80 }],
    [{ systolic: 9999, diastolic: 9999 }],
  ])("blocks an impossible entry %o", (v) => {
    expect(checkBp(v).status).toBe("blocked");
  });
});

describe("checkGlucose", () => {
  it("accepts typical values in both units, returning mg/dL", () => {
    expect(checkGlucose(101, "mgdl")).toEqual({ status: "ok", value: 101 });
    expect(checkGlucose(5.6, "mmol")).toEqual({ status: "ok", value: 100.8 });
  });

  it("catches a mmol value typed in mg/dL mode", () => {
    const r = checkGlucose(5.6, "mgdl");
    expect(r.status).toBe("confirm");
    if (r.status === "confirm") {
      expect(r.suggestion).toBe(100.8);
      expect(r.message).toContain("5.6 mmol/L");
      expect(r.allowAsEntered).toBe(false); // 5.6 mg/dL is impossible
    }
  });

  it("still allows a real, very low mg/dL reading after asking", () => {
    const r = checkGlucose(30, "mgdl");
    expect(r.status).toBe("confirm");
    if (r.status === "confirm") expect(r.allowAsEntered).toBe(true);
  });

  it("catches a mg/dL value typed in mmol mode", () => {
    const r = checkGlucose(101, "mmol");
    expect(r.status === "confirm" && r.suggestion).toBe(101);
  });

  it("asks about a very high but possible reading", () => {
    const r = checkGlucose(650, "mgdl");
    expect(r.status === "confirm" && r.allowAsEntered).toBe(true);
  });

  it.each([
    [0, "mgdl"],
    [-5, "mmol"],
    [5000, "mgdl"],
  ] as const)("blocks %s %s", (v, unit) => {
    expect(checkGlucose(v, unit).status).toBe("blocked");
  });
});

describe("wire schemas", () => {
  const base = {
    id: "4f9c2c1e-8a3b-4d7e-9f10-2b3c4d5e6f70",
    patientId: "p1",
    measuredAt: "2026-11-22T07:42:00+01:00",
    measuredTz: "Africa/Lagos",
  };

  it("accepts a valid BP reading", () => {
    expect(
      bpReadingSchema.safeParse({
        ...base,
        type: "bp",
        systolic: 128,
        diastolic: 82,
        pulse: 71,
      }).success,
    ).toBe(true);
  });

  it("rejects swapped BP numbers server-side too", () => {
    expect(
      readingSchema.safeParse({
        ...base,
        type: "bp",
        systolic: 80,
        diastolic: 120,
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown timezone", () => {
    expect(
      readingSchema.safeParse({
        ...base,
        measuredTz: "Mars/Olympus",
        type: "glucose",
        valueMgdl: 100,
        context: "fasting",
      }).success,
    ).toBe(false);
  });
});

describe("time-of-day rules", () => {
  it("matches the PLAN.md morning/evening windows", () => {
    expect(bpPeriod(4)).toBe("morning");
    expect(bpPeriod(11)).toBe("morning");
    expect(bpPeriod(12)).toBe("afternoon");
    expect(bpPeriod(17)).toBe("evening");
    expect(bpPeriod(2)).toBe("night");
  });

  it("defaults glucose context sensibly", () => {
    expect(defaultGlucoseContext(7)).toBe("fasting");
    expect(defaultGlucoseContext(13)).toBe("random");
    expect(defaultGlucoseContext(22)).toBe("bedtime");
  });
});
