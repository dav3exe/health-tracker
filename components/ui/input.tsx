import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // 64px tall, 2px border at ≥ 3:1 contrast, 20px text (DESIGN.md §4).
        // Number fields override the text size to text-reading via className.
        "h-16 w-full min-w-0 rounded-button border-2 border-input bg-surface px-4 text-body text-text transition-colors placeholder:text-text-muted focus-visible:border-text disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-flag",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
