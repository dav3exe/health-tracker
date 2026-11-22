"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { NumberField } from "@/components/logging/NumberField";
import { DidYouMeanDialog } from "@/components/logging/DidYouMeanDialog";
import { SavedView } from "@/components/logging/SavedView";
import { useDeviceSettings } from "@/lib/offline/hooks";
import { saveReading, undoReading } from "@/lib/offline/outbox";
import {
  GLUCOSE_CONTEXT_LABEL,
  defaultGlucoseContext,
  deviceTimeZone,
  formatTime,
  toIsoWithOffset,
} from "@/lib/readings/time";
import { fromMgdl, unitLabel } from "@/lib/units";
import {
  GLUCOSE_CONTEXTS,
  checkGlucose,
  type GlucoseContext,
} from "@/lib/validation/readings";

// Blood sugar entry: one number + when it was taken. The "when" (context)
// matters as much as the number: a fasting 130 and an after-meal 130 mean
// different things to a doctor, and the stats split them (PLAN.md §5.3).

type Confirm = Extract<ReturnType<typeof checkGlucose>, { status: "confirm" }>;

export function GlucoseForm() {
  const settings = useDeviceSettings();
  const unit = settings.glucoseUnit;
  const [measuredAt] = useState(() => new Date());
  const [value, setValue] = useState("");
  const [context, setContext] = useState<GlucoseContext>(() =>
    defaultGlucoseContext(measuredAt.getHours()),
  );
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [saved, setSaved] = useState<{
    id: string;
    mgdl: number;
    at: string;
  } | null>(null);
  const errorId = "glucose-error";

  async function save(mgdl: number) {
    const patientId = settings.activePatientId;
    if (!patientId) return;
    const iso = toIsoWithOffset(measuredAt);
    const record = await saveReading({
      id: crypto.randomUUID(),
      type: "glucose",
      patientId,
      measuredAt: iso,
      measuredTz: deviceTimeZone(),
      valueMgdl: mgdl,
      context,
    });
    setConfirm(null);
    setSaved({ id: record.id, mgdl, at: iso });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!value) {
      setError("Please enter the number from your meter.");
      return;
    }
    const result = checkGlucose(Number(value), unit);
    if (result.status === "blocked") setError(result.message);
    else if (result.status === "confirm") setConfirm(result);
    else void save(result.value);
  }

  // Show numbers in the patient's unit, even when a unit slip was corrected.
  const display = (mgdl: number) =>
    unit === "mmol"
      ? fromMgdl(mgdl, unit).toFixed(1)
      : String(fromMgdl(mgdl, unit));

  if (saved) {
    return (
      <SavedView
        value={display(saved.mgdl)}
        unit={unitLabel(unit)}
        detail={`${GLUCOSE_CONTEXT_LABEL[context]} · ${formatTime(saved.at)}`}
        onUndo={async () => {
          await undoReading(saved.id);
          setValue(display(saved.mgdl));
          setSaved(null);
        }}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col gap-6">
      <p className="text-body text-text-muted">
        {formatTime(toIsoWithOffset(measuredAt))}
      </p>

      <NumberField
        label="Blood sugar"
        hint="The number on your meter"
        unit={unitLabel(unit)}
        value={value}
        onChange={setValue}
        // Always allow a decimal point, even in mg/dL mode. If "." were
        // stripped, a mmol/L value like 5.6 would silently become 56 mg/dL
        // and skip the unit-slip check entirely (caught in E2E testing).
        decimal
        autoFocus
        enterKeyHint="done"
        invalid={!!error}
        describedBy={error ? errorId : undefined}
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-label font-bold">
          When was it taken?
        </legend>
        {/* Radix ToggleGroup type="single" gives proper radio semantics and
            arrow-key support. We stop it from being cleared: a reading must
            always have a context, and an accidental second tap shouldn't
            silently remove it. */}
        <ToggleGroup
          type="single"
          value={context}
          onValueChange={(v) => v && setContext(v as GlucoseContext)}
          className="flex w-full flex-wrap gap-3"
          aria-label="When was it taken?"
        >
          {GLUCOSE_CONTEXTS.map((c) => (
            <ToggleGroupItem key={c} value={c}>
              {GLUCOSE_CONTEXT_LABEL[c]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </fieldset>

      {error && (
        <p
          id={errorId}
          role="alert"
          className="rounded-button border-2 border-flag bg-surface px-4 py-3 text-body font-bold text-flag"
        >
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="mt-auto">
        Save
      </Button>

      {confirm && (
        <DidYouMeanDialog
          open
          message={confirm.message}
          suggestionLabel={
            confirm.suggestion !== undefined
              ? `Use ${display(confirm.suggestion)} ${unitLabel(unit)}`
              : undefined
          }
          allowKeep={confirm.allowAsEntered}
          onUseSuggestion={() =>
            confirm.suggestion !== undefined && void save(confirm.suggestion)
          }
          onKeep={() => void save(confirm.value)}
          onEdit={() => setConfirm(null)}
        />
      )}
    </form>
  );
}
