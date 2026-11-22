"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/logging/NumberField";
import { DidYouMeanDialog } from "@/components/logging/DidYouMeanDialog";
import { SavedView } from "@/components/logging/SavedView";
import { useDeviceSettings } from "@/lib/offline/hooks";
import { saveReading, undoReading } from "@/lib/offline/outbox";
import {
  BP_PERIOD_LABEL,
  bpPeriod,
  deviceTimeZone,
  formatTime,
  toIsoWithOffset,
} from "@/lib/readings/time";
import { checkBp, type BpValue } from "@/lib/validation/readings";

// Blood pressure entry: the most-used screen in the app, so every tap counts.
// Target: open → three numbers → Save → done in about 10 seconds.

type Confirm = Extract<ReturnType<typeof checkBp>, { status: "confirm" }>;

// Auto-advance rules. A systolic starting with 1 or 2 needs three digits
// (100–299); one starting with 3–9 is complete at two (e.g. 95). Diastolic
// starting with 1 needs three (100–150); anything else is two (40–99).
const systolicDone = (v: string) =>
  v.length === 3 || (v.length === 2 && v[0] >= "3");
const diastolicDone = (v: string) =>
  v.length === 3 || (v.length === 2 && v[0] !== "1");

export function BpForm() {
  const settings = useDeviceSettings();
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [pulse, setPulse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [saved, setSaved] = useState<{
    id: string;
    value: BpValue;
    at: string;
  } | null>(null);
  const diaRef = useRef<HTMLInputElement>(null);
  const pulseRef = useRef<HTMLInputElement>(null);

  // The time is captured when the screen opens, i.e. right after the cuff
  // reading, not when Save is finally pressed after a correction.
  const [measuredAt] = useState(() => new Date());
  const period = BP_PERIOD_LABEL[bpPeriod(measuredAt.getHours())];
  const errorId = "bp-error";

  async function save(value: BpValue) {
    const patientId = settings.activePatientId;
    if (!patientId) return; // provider creates one on first load
    const iso = toIsoWithOffset(measuredAt);
    const record = await saveReading({
      id: crypto.randomUUID(),
      type: "bp",
      patientId,
      measuredAt: iso,
      measuredTz: deviceTimeZone(),
      systolic: value.systolic,
      diastolic: value.diastolic,
      ...(value.pulse !== undefined && { pulse: value.pulse }),
    });
    setConfirm(null);
    setSaved({ id: record.id, value, at: iso });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!sys || !dia) {
      setError("Please enter both the top and bottom numbers.");
      return;
    }
    const value: BpValue = {
      systolic: Number(sys),
      diastolic: Number(dia),
      ...(pulse && { pulse: Number(pulse) }),
    };
    const result = checkBp(value);
    if (result.status === "blocked") setError(result.message);
    else if (result.status === "confirm") setConfirm(result);
    else void save(result.value);
  }

  if (saved) {
    const { value } = saved;
    return (
      <SavedView
        value={`${value.systolic}/${value.diastolic}`}
        unit="mmHg"
        detail={[
          value.pulse !== undefined ? `Pulse ${value.pulse}` : null,
          `${period}, ${formatTime(saved.at)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        onUndo={async () => {
          await undoReading(saved.id);
          // Put the numbers back so a small fix doesn't mean retyping.
          setSys(String(value.systolic));
          setDia(String(value.diastolic));
          setPulse(value.pulse !== undefined ? String(value.pulse) : "");
          setSaved(null);
        }}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col gap-6">
      <p className="text-body text-text-muted">
        {period} · {formatTime(toIsoWithOffset(measuredAt))}
      </p>

      <NumberField
        label="Top number"
        hint="The bigger number (systolic)"
        unit="mmHg"
        value={sys}
        onChange={setSys}
        autoFocus
        invalid={!!error && !sys}
        describedBy={error ? errorId : undefined}
        isComplete={systolicDone}
        onComplete={() => diaRef.current?.focus()}
      />
      <NumberField
        ref={diaRef}
        label="Bottom number"
        hint="The smaller number (diastolic)"
        unit="mmHg"
        value={dia}
        onChange={setDia}
        invalid={!!error && !dia}
        describedBy={error ? errorId : undefined}
        isComplete={diastolicDone}
        onComplete={() => pulseRef.current?.focus()}
      />
      <NumberField
        ref={pulseRef}
        label="Pulse (optional)"
        hint="Heart beats per minute"
        unit="bpm"
        value={pulse}
        onChange={setPulse}
        enterKeyHint="done"
      />

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
            confirm.suggestion
              ? `Use ${confirm.suggestion.systolic}/${confirm.suggestion.diastolic}`
              : undefined
          }
          allowKeep={confirm.allowAsEntered}
          onUseSuggestion={() =>
            confirm.suggestion && void save(confirm.suggestion)
          }
          onKeep={() => void save(confirm.value)}
          onEdit={() => setConfirm(null)}
        />
      )}
    </form>
  );
}
