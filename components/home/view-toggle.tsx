"use client";

import { cn } from "@/lib/utils/cn";

type ViewToggleProps = {
  view: "editorial" | "shop" | "grouped";
  onChange: (view: "editorial" | "shop" | "grouped") => void;
};

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center rounded-full border border-border bg-surface p-1 text-sm">
      <button
        type="button"
        className={cn(
          "rounded-full px-3 py-1.5 transition",
          view === "editorial" ? "bg-contrast text-ink" : "text-muted",
        )}
        onClick={() => onChange("editorial")}
        aria-pressed={view === "editorial"}
      >
        Editorial
      </button>
      <button
        type="button"
        className={cn(
          "rounded-full px-3 py-1.5 transition",
          view === "shop" ? "bg-contrast text-ink" : "text-muted",
        )}
        onClick={() => onChange("shop")}
        aria-pressed={view === "shop"}
      >
        Shop
      </button>
      <button
        type="button"
        className={cn(
          "rounded-full px-3 py-1.5 transition",
          view === "grouped" ? "bg-contrast text-ink" : "text-muted",
        )}
        onClick={() => onChange("grouped")}
        aria-pressed={view === "grouped"}
      >
        Grouped
      </button>
    </div>
  );
}
