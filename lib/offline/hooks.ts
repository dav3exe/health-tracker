"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { DEFAULT_SETTINGS, getSettings, localDb } from "@/lib/offline/db";
import { listReadings } from "@/lib/offline/outbox";

// Live views of the phone's database. useLiveQuery re-renders whenever the
// underlying rows change, from this tab OR the sync loop, so "Saved on this
// phone" flips to "All saved" by itself the moment a sync succeeds.

export function useDeviceSettings() {
  return useLiveQuery(getSettings, [], DEFAULT_SETTINGS);
}

export function usePendingCount(): number {
  return (
    useLiveQuery(
      () => localDb().readings.where("syncState").equals("pending").count(),
      [],
    ) ?? 0
  );
}

/** undefined while loading, so screens can show a skeleton, not "no data". */
export function useReadings(patientId: string | null, sinceIso?: string) {
  return useLiveQuery(
    () => (patientId ? listReadings(patientId, sinceIso) : []),
    [patientId, sinceIso],
  );
}
