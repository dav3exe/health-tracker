"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, LogOut, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { GoogleSignInButton } from "@/components/account/GoogleSignInButton";
import { InviteCard } from "@/components/account/InviteCard";
import {
  meQueryKey,
  updatePatientRequest,
  useMe,
  type PatientSummary,
} from "@/lib/account/client";
import { localDb, updateSettings } from "@/lib/offline/db";
import { useDeviceSettings } from "@/lib/offline/hooks";
import { pendingCount, syncNow } from "@/lib/offline/outbox";
import type { GlucoseUnit } from "@/lib/units";

// Settings, simplest first. A patient's phone (device sign-in) sees only the
// unit setting; caregivers also see who they look after and phone setup.
export function SettingsPanel() {
  const { status } = useSession();
  const { data: me } = useMe();
  const settings = useDeviceSettings();
  const queryClient = useQueryClient();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const active = me?.patients.find((p) => p.id === settings.activePatientId);
  const canEdit = active && active.role !== "viewer";

  async function choosePatient(p: PatientSummary) {
    await updateSettings({
      activePatientId: p.id,
      patientName: p.displayName,
      glucoseUnit: p.glucoseUnit,
    });
    void syncNow(); // pull this person's readings onto the phone
  }

  async function setUnit(unit: GlucoseUnit) {
    await updateSettings({ glucoseUnit: unit });
    if (active && canEdit) {
      await updatePatientRequest(active.id, { glucoseUnit: unit }).catch(
        () => {},
      );
      await queryClient.invalidateQueries({ queryKey: meQueryKey });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {status === "unauthenticated" && (
        <section className="flex flex-col gap-4 rounded-card border-2 border-primary bg-primary-soft p-5">
          <h2 className="text-body font-bold">Back up your readings</h2>
          <p className="text-label">
            Right now readings are only on this phone. Sign in to keep them safe
            and share them with family or a doctor.
          </p>
          <GoogleSignInButton />
        </section>
      )}

      {me && me.user.kind === "google" && me.patients.length > 1 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-body font-bold">Logging for</h2>
          <ul className="flex flex-col gap-2">
            {me.patients.map((p) => {
              const selected = p.id === settings.activePatientId;
              return (
                <li key={p.id}>
                  <Button
                    size="lg"
                    variant={selected ? "secondary" : "outline"}
                    aria-pressed={selected}
                    className="w-full justify-between"
                    onClick={() => void choosePatient(p)}
                  >
                    {p.displayName}
                    {selected && <Check aria-hidden />}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-body font-bold">Blood sugar unit</h2>
        <p className="text-label text-text-muted">
          Use the unit shown on the meter.
        </p>
        <ToggleGroup
          type="single"
          value={settings.glucoseUnit}
          onValueChange={(v) => v && void setUnit(v as GlucoseUnit)}
          className="flex w-full flex-wrap gap-3"
          aria-label="Blood sugar unit"
        >
          <ToggleGroupItem value="mgdl">mg/dL</ToggleGroupItem>
          <ToggleGroupItem value="mmol">mmol/L</ToggleGroupItem>
        </ToggleGroup>
      </section>

      {active?.role === "owner" && me?.user.kind === "google" && (
        <InviteCard patientId={active.id} patientName={active.displayName} />
      )}

      {me?.user.kind === "google" && (
        <Button asChild size="lg" variant="outline">
          <Link href="/setup/another">
            <UserPlus aria-hidden />
            Add another person
          </Link>
        </Button>
      )}

      {status === "authenticated" && (
        <section className="flex flex-col gap-3 border-t border-border-subtle pt-6">
          {me && (
            <p className="text-label text-text-muted">
              Signed in
              {me.user.email ? ` as ${me.user.email}` : " on this phone"}
            </p>
          )}
          <Button
            size="lg"
            variant="ghost"
            className="w-fit"
            onClick={async () => {
              // Health data must not stay on a phone after sign-out (PLAN.md §6),
              // but clearing must never destroy readings that only exist here.
              await syncNow();
              const unsent = await pendingCount();
              if (unsent > 0) {
                setSignOutError(
                  `${unsent} reading${unsent === 1 ? " hasn't" : "s haven't"} been backed up yet. Connect to the internet, then try again.`,
                );
                return;
              }
              await localDb().readings.clear();
              await localDb().settings.clear();
              await signOut({ redirectTo: "/" });
            }}
          >
            <LogOut aria-hidden />
            Sign out
          </Button>
          {signOutError && (
            <p role="alert" className="text-body font-bold text-flag">
              {signOutError}
            </p>
          )}
        </section>
      )}

      <p className="text-small text-text-muted">
        This app records readings and shares them. It does not give medical
        advice. Talk to your doctor about your readings.
      </p>
    </div>
  );
}
