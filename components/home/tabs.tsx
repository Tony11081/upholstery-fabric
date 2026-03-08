"use client";

import { cn } from "@/lib/utils/cn";

const tabs = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "videos", label: "Videos" },
  { key: "editorial", label: "Editorial" },
];

type TabsProps = {
  value: "all" | "new" | "videos" | "editorial";
  onChange: (value: "all" | "new" | "videos" | "editorial") => void;
};

export function Tabs({ value, onChange }: TabsProps) {
  return (
    <div className="flex gap-4 border-b border-border/80 px-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key as TabsProps["value"])}
          className={cn(
            "relative pb-3 text-sm font-medium text-muted transition hover:text-ink",
            value === tab.key ? "text-ink" : "",
          )}
        >
          {tab.label}
          {value === tab.key && (
            <span className="absolute inset-x-0 -bottom-[1px] mx-auto h-[2px] w-full max-w-[28px] rounded-full bg-ink" />
          )}
        </button>
      ))}
    </div>
  );
}
