"use client";

import { useEffect, useState } from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OfflineProvider } from "@/components/providers/OfflineProvider";
import { useMe } from "@/lib/account/client";
import { getSettings, updateSettings } from "@/lib/offline/db";
import {
  reassignLocalReadings,
  retryRejected,
  syncNow,
} from "@/lib/offline/outbox";

// Everything client-side the whole app needs, mounted once in the layout.
export function AppProviders({ children }: { children: React.ReactNode }) {
  // One QueryClient per browser tab (useState so it survives re-renders but
  // is never shared between users on the server).
  const [queryClient] = useState(() => new QueryClient());
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <OfflineProvider>
          <AccountSync />
          {children}
        </OfflineProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}

// Keeps the phone's "which patient am I logging for" in step with the account.
//
// After sign-in, the server says which patients this user can see. If the
// phone's active patient isn't one of them (e.g. readings were logged before
// signing in, under a local-only id), those unsynced readings move to the
// user's first patient and sync. Name and glucose unit are copied locally so
// the forms work offline.
function AccountSync() {
  const { data: me } = useMe();

  useEffect(() => {
    if (!me || me.patients.length === 0) return;
    void (async () => {
      const settings = await getSettings();
      let active = me.patients.find((p) => p.id === settings.activePatientId);
      if (!active) {
        active = me.patients[0];
        if (settings.activePatientId) {
          await reassignLocalReadings(settings.activePatientId, active.id);
        }
      }
      await updateSettings({
        activePatientId: active.id,
        patientName: active.displayName,
        glucoseUnit: active.glucoseUnit,
      });
      // Readings rejected before the profile existed can go through now.
      await retryRejected();
      void syncNow();
    })();
  }, [me]);

  return null;
}
