"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Me } from "@/lib/account/client";
import { getSettings, updateSettings } from "@/lib/offline/db";
import { reassignLocalReadings, retryRejected } from "@/lib/offline/outbox";

// Opened on the PATIENT'S phone. One big button, on purpose: the link is
// single-use, so it must not be consumed by a link preview (chat apps fetch
// links to show previews) or by an accidental reload. Nothing happens until a
// person taps.
export function RedeemInvite() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<"idle" | "working" | "failed">("idle");

  async function start() {
    setState("working");
    const res = await signIn("invite", { token, redirect: false });
    if (!res || res.error || !(await getSession())) {
      setState("failed");
      return;
    }
    // Point this phone at the patient the invite was for.
    const me = (await fetch("/api/me").then((r) => r.json())) as Me;
    const patient = me.patients[0];
    if (patient) {
      const settings = await getSettings();
      if (settings.activePatientId) {
        // Anything logged on this phone before setup belongs to this person.
        await reassignLocalReadings(settings.activePatientId, patient.id);
      }
      await updateSettings({
        activePatientId: patient.id,
        patientName: patient.displayName,
        glucoseUnit: patient.glucoseUnit,
      });
      await retryRejected();
    }
    router.replace("/");
  }

  if (state === "failed") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-title font-bold">This link doesn&rsquo;t work</h1>
        <p className="text-body text-text-muted">
          It may have been used already or be more than 7 days old. Please ask
          the person who sent it for a new one.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-8">
      <span className="flex size-20 items-center justify-center rounded-full bg-primary-soft text-primary">
        <HeartPulse aria-hidden className="size-10" />
      </span>
      <div className="flex flex-col gap-3">
        <h1 className="text-title font-bold">Set up this phone</h1>
        <p className="text-body">
          After this, you can save your blood pressure and blood sugar on this
          phone. Your family can see them too.
        </p>
        <p className="text-body text-text-muted">No password needed.</p>
      </div>
      <Button
        size="lg"
        className="mt-auto"
        disabled={state === "working"}
        onClick={() => void start()}
      >
        {state === "working" ? "Setting up…" : "Start"}
      </Button>
    </div>
  );
}
