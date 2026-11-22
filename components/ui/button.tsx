import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Slot } from "radix-ui";

// Restyled from shadcn defaults for our users (DESIGN.md §2): the stock
// sizes (24-36px tall, 12-14px text) are far below our 56px / 16px floors, so
// the small sizes are removed entirely rather than left as a temptation.
// Focus uses the global 3px :focus-visible outline, not a faint ring.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-3 rounded-button border-2 border-transparent font-bold whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-flag [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-6",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-on-primary shadow-primary hover:bg-primary-hover",
        // Outline keeps a RED border so it still reads as a button by shape.
        outline: "border-primary bg-surface text-primary hover:bg-primary-soft",
        secondary: "bg-primary-soft text-primary hover:bg-primary-soft-border",
        ghost: "text-text hover:bg-surface-muted",
        destructive: "bg-flag text-on-flag hover:opacity-90",
        link: "text-primary underline underline-offset-4",
      },
      size: {
        default: "min-h-14 px-6 text-body",
        lg: "min-h-16 px-8 text-body",
        icon: "size-14",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
