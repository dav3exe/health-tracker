"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

// The gentle "Did you mean…?" step (PLAN.md §5.2). Never an error, never a
// dead end. Up to three choices, stacked full width, recommended first:
//   1. Use the suggested value (if we have a good guess)
//   2. Keep what I typed (only if it's possible at all)
//   3. Let me change it (always)

type Props = {
  open: boolean;
  message: string;
  /** e.g. "Use 120/80". Omit when there's no single good guess. */
  suggestionLabel?: string;
  keepLabel?: string;
  allowKeep: boolean;
  onUseSuggestion: () => void;
  onKeep: () => void;
  onEdit: () => void;
};

export function DidYouMeanDialog({
  open,
  message,
  suggestionLabel,
  keepLabel = "Yes, save it as I typed",
  allowKeep,
  onUseSuggestion,
  onKeep,
  onEdit,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onEdit()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Please check this number</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {suggestionLabel && (
            <Button size="lg" onClick={onUseSuggestion}>
              {suggestionLabel}
            </Button>
          )}
          {allowKeep && (
            <Button
              size="lg"
              variant={suggestionLabel ? "outline" : "default"}
              onClick={onKeep}
            >
              {keepLabel}
            </Button>
          )}
          <Button size="lg" variant="ghost" onClick={onEdit}>
            Change it
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
