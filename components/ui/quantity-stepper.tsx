"use client";

import { Minus, Plus } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

type QuantityStepperProps = {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  className?: string;
};

export function QuantityStepper({ value, min = 1, max = 9, onChange, className }: QuantityStepperProps) {
  const clamp = (val: number) => Math.min(Math.max(val, min), max);

  const handleChange = (delta: number) => {
    const next = clamp(value + delta);
    onChange(next);
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 rounded-full border border-border bg-surface px-3 py-2 text-sm text-ink",
        className,
      )}
      aria-label="Quantity selector"
    >
      <button
        type="button"
        className="rounded-full p-1 text-muted transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        onClick={() => handleChange(-1)}
        disabled={value <= min}
      >
        <Minus size={16} />
      </button>
      <span className="min-w-[1.5rem] text-center font-medium tabular-nums">{value}</span>
      <button
        type="button"
        className="rounded-full p-1 text-muted transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        onClick={() => handleChange(1)}
        disabled={value >= max}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
