"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type SortOption = {
  label: string;
  value: string;
};

type SortMenuProps = {
  options: SortOption[];
  value: string;
  onChange: (value: string) => void;
};

export function SortMenu({ options, value, onChange }: SortMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-2 text-sm text-ink shadow-sm transition hover:border-ink/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          <span>Sort</span>
          <ChevronsUpDown size={14} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="min-w-[200px] rounded-lg border border-border bg-surface p-1 shadow-[var(--shadow-float)] z-50"
        >
          {options.map((option) => (
            <DropdownMenu.Item
              key={option.value}
              onSelect={() => onChange(option.value)}
              className={cn(
                "cursor-pointer rounded-md px-3 py-2 text-sm text-ink outline-none transition hover:bg-contrast/80",
                option.value === value ? "bg-contrast text-ink font-medium" : "text-muted",
              )}
            >
              {option.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
