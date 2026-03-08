import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

const chipStyles = cva(
  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2",
  {
    variants: {
      active: {
        true: "border-ink bg-contrast text-ink",
        false: "border-border text-muted hover:text-ink",
      },
      tone: {
        neutral: "",
        accent: "border-accent text-ink bg-accent/30",
      },
    },
    defaultVariants: {
      active: false,
      tone: "neutral",
    },
  },
);

export type ChipProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof chipStyles>;

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, active, tone, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(chipStyles({ active, tone }), className)}
        aria-pressed={Boolean(active)}
        type="button"
        {...props}
      >
        {children}
      </button>
    );
  },
);

Chip.displayName = "Chip";
