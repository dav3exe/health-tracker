"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { createPatientRequest, meQueryKey, useMe } from "@/lib/account/client";
import { getSettings, updateSettings } from "@/lib/offline/db";
import { retryRejected } from "@/lib/offline/outbox";
import { deviceTimeZone } from "@/lib/readings/time";
import type { GlucoseUnit } from "@/lib/units";

// Minimal onboarding (PLAN.md §5.1, Milestone 1): just enough to start.
// Three short steps, one question each, styled after the onboarding reference
// in DESIGN.md §9 (big question, full-width Continue, progress dots).
// Everything else (DOB, targets, medications) is optional and comes later.

type Step = "who" | "name" | "unit";
const STEPS: Step[] = ["who", "name", "unit"];

/**
 * `another`: adding a second person from Settings. Skips "who" (it's someone
 * else by definition) and always makes a fresh patient id, because this
 * phone's id already belongs to the first person.
 */
export function SetupWizard({ another = false }: { another?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status, data: session } = useSession();
  const { data: me, isLoading } = useMe();
  const [step, setStep] = useState<Step>(another ? "name" : "who");
  const [forSelf, setForSelf] = useState<boolean | null>(
    another ? false : null,
  );
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<GlucoseUnit>("mgdl");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Not signed in → sign in first. Already has a patient → nothing to set up.
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/signin");
    if (!another && me && me.patients.length > 0) router.replace("/");
  }, [status, me, router, another]);

  if (
    status !== "authenticated" ||
    isLoading ||
    !me ||
    (!another && me.patients.length > 0)
  ) {
    return <div aria-hidden className="h-64 rounded-card bg-surface-muted" />;
  }

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      // Reuse this phone's local patient id so anything logged before
      // signing up becomes part of this profile automatically.
      const settings = await getSettings();
      const id = another
        ? crypto.randomUUID()
        : (settings.activePatientId ?? crypto.randomUUID());
      const patient = await createPatientRequest({
        id,
        displayName: name.trim(),
        glucoseUnit: unit,
        timezone: deviceTimeZone(),
      });
      await updateSettings({
        activePatientId: patient.id,
        patientName: patient.displayName,
        glucoseUnit: patient.glucoseUnit,
      });
      await retryRejected();
      await queryClient.invalidateQueries({ queryKey: meQueryKey });
      // Caregivers go straight to setting up the other person's phone.
      router.replace(forSelf ? "/" : "/settings?setup=phone");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSaving(false);
    }
  }

  const steps = another ? STEPS.slice(1) : STEPS;
  const index = steps.indexOf(step);

  return (
    <div className="flex flex-1 flex-col gap-8">
      {/* Progress dots: shape + count in text, not colour alone. */}
      <div className="flex items-center gap-3">
        <div aria-hidden className="flex gap-2">
          {steps.map((s, i) => (
            <span
              key={s}
              className={
                i <= index
                  ? "h-2.5 w-8 rounded-full bg-primary"
                  : "h-2.5 w-2.5 rounded-full bg-border-strong"
              }
            />
          ))}
        </div>
        <span className="text-small text-text-muted">
          Step {index + 1} of {steps.length}
        </span>
      </div>

      {step === "who" && (
        <Question title="Who will you track readings for?">
          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              variant={forSelf === true ? "default" : "outline"}
              onClick={() => {
                setForSelf(true);
                setName(session?.user?.name ?? "");
                setStep("name");
              }}
            >
              Myself
            </Button>
            <Button
              size="lg"
              variant={forSelf === false ? "default" : "outline"}
              onClick={() => {
                setForSelf(false);
                setName("");
                setStep("name");
              }}
            >
              Someone I care for
            </Button>
          </div>
        </Question>
      )}

      {step === "name" && (
        <Question
          title={forSelf ? "What should we call you?" : "What's their name?"}
          hint="This is shown on the app and on doctor reports."
        >
          <Input
            aria-label="Name"
            autoFocus
            autoComplete={forSelf ? "name" : "off"}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            className="h-16 text-title"
          />
          <Continue disabled={!name.trim()} onClick={() => setStep("unit")} />
        </Question>
      )}

      {step === "unit" && (
        <Question
          title="Which unit does the blood sugar meter show?"
          hint="Look at the screen of the meter. You can change this later."
        >
          <ToggleGroup
            type="single"
            value={unit}
            onValueChange={(v) => v && setUnit(v as GlucoseUnit)}
            className="flex w-full flex-col gap-3"
            aria-label="Blood sugar unit"
          >
            <ToggleGroupItem value="mgdl" size="lg" className="w-full">
              mg/dL (for example 110)
            </ToggleGroupItem>
            <ToggleGroupItem value="mmol" size="lg" className="w-full">
              mmol/L (for example 6.1)
            </ToggleGroupItem>
          </ToggleGroup>
          {error && (
            <p role="alert" className="text-body font-bold text-flag">
              {error}
            </p>
          )}
          <Continue
            label={saving ? "Saving…" : "Finish"}
            disabled={saving}
            onClick={() => void finish()}
          />
        </Question>
      )}

      {index > 0 && (
        <Button
          variant="ghost"
          className="w-fit"
          onClick={() => setStep(steps[index - 1])}
        >
          Back
        </Button>
      )}
    </div>
  );
}

function Question({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-title font-bold">{title}</h2>
        {hint && <p className="text-body text-text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Continue({
  label = "Continue",
  disabled,
  onClick,
}: {
  label?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button size="lg" disabled={disabled} onClick={onClick}>
      {label}
    </Button>
  );
}
