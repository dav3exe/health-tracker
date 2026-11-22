import { describe, expect, it } from "vitest";
import type { LocalReading } from "@/lib/offline/db";
import {
  describeWhen,
  localDayKey,
  todayChecklist,
} from "@/lib/readings/today";

const TZ = "Africa/Lagos"; // UTC+1, no DST

const bp = (measuredAt: string): LocalReading => ({
  id: crypto.randomUUID(),
  type: "bp",
  patientId: "p1",
  measuredAt,
  measuredTz: TZ,
  systolic: 120,
  diastolic: 80,
  syncState: "synced",
  createdAt: measuredAt,
});

describe("localDayKey", () => {
  it("uses the reading's own timezone, not UTC", () => {
    // 23:30 UTC on the 21st is already 00:30 on the 22nd in Lagos.
    expect(localDayKey("2026-11-21T23:30:00Z", TZ)).toBe("2026-11-22");
    expect(localDayKey("2026-11-21T23:30:00Z", "UTC")).toBe("2026-11-21");
  });
});

describe("todayChecklist", () => {
  const now = new Date("2026-11-22T20:00:00+01:00");

  it("marks morning and evening BP from today's readings", () => {
    const items = todayChecklist(
      [bp("2026-11-22T07:42:00+01:00"), bp("2026-11-22T19:10:00+01:00")],
      now,
      TZ,
    );
    expect(items.find((i) => i.id === "bp_am")?.doneAt).toBeDefined();
    expect(items.find((i) => i.id === "bp_pm")?.doneAt).toBeDefined();
    expect(
      items.find((i) => i.id === "glucose_fasting")?.doneAt,
    ).toBeUndefined();
  });

  it("ignores yesterday's readings", () => {
    const items = todayChecklist([bp("2026-11-21T07:42:00+01:00")], now, TZ);
    expect(items.every((i) => !i.doneAt)).toBe(true);
  });
});

describe("describeWhen", () => {
  const now = new Date("2026-11-22T20:00:00+01:00");
  it("labels today by part of day and yesterday by name", () => {
    expect(describeWhen("2026-11-22T07:42:00+01:00", TZ, now)).toMatch(
      /^This morning, /,
    );
    expect(describeWhen("2026-11-21T19:05:00+01:00", TZ, now)).toMatch(
      /^Yesterday, /,
    );
  });
});
