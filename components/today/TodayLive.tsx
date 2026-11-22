"use client";

import { useMemo } from "react";
import { SyncStatus } from "@/components/ui/SyncStatus";
import { AccountBanner } from "@/components/today/AccountBanner";
import { TodayChecklist } from "@/components/today/TodayChecklist";
import { LatestReadingCard } from "@/components/today/LatestReadingCard";
import {
  useDeviceSettings,
  usePendingCount,
  useReadings,
} from "@/lib/offline/hooks";
import { describeWhen, todayChecklist } from "@/lib/readings/today";
import { deviceTimeZone } from "@/lib/readings/time";

// The live part of Today: reads from the phone's own database, so it works
// offline and updates the instant a reading is saved or synced.
export function TodayLive() {
  const settings = useDeviceSettings();
  const readings = useReadings(settings.activePatientId);
  const pending = usePendingCount();

  const { checklist, latestBp } = useMemo(() => {
    const now = new Date();
    const rows = readings ?? [];
    return {
      checklist: todayChecklist(rows, now, deviceTimeZone()),
      // Rows are newest first, so the first BP is the latest.
      latestBp: rows.find((r) => r.type === "bp"),
    };
  }, [readings]);

  return (
    <>
      <TodayChecklist items={checklist} />

      {/* Below the checklist on purpose: logging and "what's left" come
          first; looking back at the last reading is secondary. The 7-day
          average and target badge arrive with server stats (Milestone 2). */}
      {latestBp?.type === "bp" && (
        <LatestReadingCard
          reading={{
            systolic: latestBp.systolic,
            diastolic: latestBp.diastolic,
            pulse: latestBp.pulse,
            when: describeWhen(
              latestBp.measuredAt,
              latestBp.measuredTz,
              new Date(),
            ),
          }}
        />
      )}

      <SyncStatus pending={pending} />
      <AccountBanner />
    </>
  );
}
