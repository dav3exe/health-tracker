"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Toggle as TogglePrimitive } from "radix-ui";

// Restyled for chips (DESIGN.md §4 ChipGroup): ≥ 56px tall, 18px text.
// "On" is shown THREE ways (red tint, red 2px border, bold text) so the
// selection is clear without relying on colour vision.
const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full border-2 border-border-strong bg-surface font-normal text-text transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-50 data-[state=on]:border-primary data-[state=on]:bg-primary-soft data-[state=on]:font-bold data-[state=on]:text-primary [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "",
        outline: "",
      },
      size: {
        default: "min-h-14 px-5 text-label",
        lg: "min-h-16 px-6 text-body",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
