"use client";

import { forwardRef, useId } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// The big number box used for every reading (DESIGN.md §4 NumberField).
//
// - inputMode="numeric"/"decimal" opens the phone's NUMBER keypad, not the
//   full keyboard: fewer, bigger keys, and no letters to typo.
// - type="text" (not "number"): type=number lets the scroll wheel change the
//   value and accepts "e", both classic sources of silent wrong readings.
// - The unit sits inside the box so it's always seen with the number.
// - Errors are announced (aria-describedby + role=alert in the parent) and
//   shown as words, not just a red border.

type Props = {
  label: string;
  /** Plain-language helper under the label, e.g. "The bigger number". */
  hint?: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  decimal?: boolean;
  invalid?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
  /** "next" shows a → key on the keypad; "done" closes it. */
  enterKeyHint?: "next" | "done";
  /** Called when the value looks complete, to auto-advance to the next box. */
  onComplete?: () => void;
  /** Digit count after which a value starting with `leadsToThree` is done. */
  isComplete?: (value: string) => boolean;
};

export const NumberField = forwardRef<HTMLInputElement, Props>(
  function NumberField(
    {
      label,
      hint,
      unit,
      value,
      onChange,
      decimal = false,
      invalid,
      describedBy,
      autoFocus,
      enterKeyHint = "next",
      onComplete,
      isComplete,
    },
    ref,
  ) {
    const id = useId();
    const hintId = `${id}-hint`;

    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="flex flex-col">
          <span className="text-label font-bold">{label}</span>
          {hint && (
            <span id={hintId} className="text-small text-text-muted">
              {hint}
            </span>
          )}
        </label>
        <div className="relative">
          <Input
            ref={ref}
            id={id}
            type="text"
            inputMode={decimal ? "decimal" : "numeric"}
            pattern={decimal ? "[0-9]*[.,]?[0-9]*" : "[0-9]*"}
            autoComplete="off"
            enterKeyHint={enterKeyHint}
            autoFocus={autoFocus}
            value={value}
            aria-invalid={invalid || undefined}
            aria-describedby={
              [hint ? hintId : null, describedBy].filter(Boolean).join(" ") ||
              undefined
            }
            onChange={(e) => {
              // Keep digits (and one decimal point). Accept a comma as the
              // decimal mark too: many phones in many locales show "," first.
              let v = e.target.value.replace(",", ".");
              v = decimal
                ? v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1")
                : v.replace(/\D/g, "");
              v = v.slice(0, decimal ? 5 : 4);
              onChange(v);
              if (onComplete && isComplete?.(v)) onComplete();
            }}
            className={cn(
              "tabular h-20 pr-24 text-reading font-bold",
              invalid && "border-flag",
            )}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-label text-text-muted"
          >
            {unit}
          </span>
        </div>
      </div>
    );
  },
);
