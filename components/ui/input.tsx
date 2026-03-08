import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  prefix?: React.ReactNode;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, prefix, ...props }, ref) => {
    return (
      <label className="flex flex-col gap-2 text-sm text-ink">
        {label && <span className="font-medium text-ink">{label}</span>}
        <div
          className={cn(
            "flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-3 transition focus-within:border-ink focus-within:shadow-[var(--shadow-float)]",
            error ? "border-danger" : null,
          )}
        >
          {prefix && <span className="text-muted">{prefix}</span>}
          <input
            ref={ref}
            className={cn(
              "w-full bg-transparent text-sm text-ink placeholder:text-muted/70 focus:outline-none",
              className,
            )}
            {...props}
          />
        </div>
        {error && <span className="text-xs text-danger">{error}</span>}
      </label>
    );
  },
);

Input.displayName = "Input";
