"use client";

import { useEffect } from "react";
import { getSettings, updateSettings } from "@/lib/offline/db";
import { startAutoSync } from "@/lib/offline/outbox";

// Mounted once in the root layout. Two jobs:
//
// 1. Keep syncing in the background (reconnect, app foregrounded, every minute)
//    so readings leave the phone without the user doing anything.
//
// 2. TEMPORARY until sign-in + onboarding land (later in Milestone 1): make
//    sure this device has a patient to log against, by creating a local
//    patient id on first run. Onboarding will later link this id to a real
//    patient profile on the server, so readings logged before signing up are
//    kept, not thrown away.
export function OfflineProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void (async () => {
      const s = await getSettings();
      if (!s.activePatientId) {
        await updateSettings({ activePatientId: crypto.randomUUID() });
      }
    })();
    return startAutoSync();
  }, []);

  return <>{children}</>;
}
