"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState } from "react";
import type { Category } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { getBrandInfo } from "@/lib/utils/brands";
import {
  CATALOG_GROUP_OPTIONS,
  COLOR_FILTER_OPTIONS,
  MATERIAL_FILTER_OPTIONS,
  SIZE_FILTER_OPTIONS,
} from "@/lib/utils/catalog-filters";

type FilterState = {
  category: string | null;
  categoryGroup: string | null;
  brand: string | null;
  color: string | null;
  size: string | null;
  material: string | null;
  minPrice: string;
  maxPrice: string;
  availability: boolean;
};

type FilterModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  brands: string[];
  initial: FilterState;
  onApply: (value: FilterState) => void;
  onClear: () => void;
};

export function FilterModal({
  open,
  onOpenChange,
  categories,
  brands,
  initial,
  onApply,
  onClear,
}: FilterModalProps) {
  const [draft, setDraft] = useState<FilterState>(initial);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft(initial);
    }
    onOpenChange(next);
  };

  const handleApply = () => {
    onApply(draft);
    onOpenChange(false);
  };

  const handleClear = () => {
    setDraft({
      category: null,
      categoryGroup: null,
      brand: null,
      color: null,
      size: null,
      material: null,
      minPrice: "",
      maxPrice: "",
      availability: false,
    });
    onClear();
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-4 top-[10%] z-50 mx-auto max-h-[80vh] max-w-xl rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-soft)] focus:outline-none">
          <div className="flex items-center justify-between">
            <Dialog.Title className="font-display text-xl">Refine</Dialog.Title>
            <Dialog.Close className="rounded-full p-2 text-muted transition hover:bg-contrast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
              <X size={16} />
            </Dialog.Close>
          </div>

          <div className="mt-6 space-y-6">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Brand</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                <button
                  type="button"
                  className={cn(
                    "rounded-full border px-3 py-2 text-sm transition",
                    draft.brand === null
                      ? "border-ink bg-contrast text-ink"
                      : "border-border text-muted hover:text-ink",
                  )}
                  onClick={() => setDraft((prev) => ({ ...prev, brand: null }))}
                >
                  All
                </button>
                {brands.map((brand) => {
                  const brandLabel = getBrandInfo({ tags: [brand] })?.label ?? brand;
                  return (
                  <button
                    key={brand}
                    type="button"
                    className={cn(
                      "rounded-full border px-3 py-2 text-sm transition",
                      draft.brand === brand
                        ? "border-ink bg-contrast text-ink"
                        : "border-border text-muted hover:text-ink",
                    )}
                    onClick={() => setDraft((prev) => ({ ...prev, brand }))}
                  >
                    {brandLabel}
                  </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Main category</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {CATALOG_GROUP_OPTIONS.map((group) => (
                  <button
                    key={group.value}
                    type="button"
                    className={cn(
                      "rounded-full border px-3 py-2 text-sm transition",
                      (draft.categoryGroup ?? "all") === group.value
                        ? "border-ink bg-contrast text-ink"
                        : "border-border text-muted hover:text-ink",
                    )}
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        categoryGroup: group.value === "all" ? null : group.value,
                      }))
                    }
                  >
                    {group.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Category</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                <button
                  type="button"
                  className={cn(
                    "rounded-full border px-3 py-2 text-sm transition",
                    draft.category === null
                      ? "border-ink bg-contrast text-ink"
                      : "border-border text-muted hover:text-ink",
                  )}
                  onClick={() => setDraft((prev) => ({ ...prev, category: null }))}
                >
                  All
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={cn(
                      "rounded-full border px-3 py-2 text-sm transition",
                      draft.category === category.slug
                        ? "border-ink bg-contrast text-ink"
                        : "border-border text-muted hover:text-ink",
                    )}
                    onClick={() => setDraft((prev) => ({ ...prev, category: category.slug }))}
                  >
                    {category.nameEn}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm text-ink">
                <span className="font-medium text-ink">Color</span>
                <select
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink"
                  value={draft.color ?? ""}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, color: event.target.value || null }))
                  }
                >
                  <option value="">All colors</option>
                  {COLOR_FILTER_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm text-ink">
                <span className="font-medium text-ink">Size</span>
                <select
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink"
                  value={draft.size ?? ""}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, size: event.target.value || null }))
                  }
                >
                  <option value="">All sizes</option>
                  {SIZE_FILTER_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm text-ink">
                <span className="font-medium text-ink">Material</span>
                <select
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink"
                  value={draft.material ?? ""}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, material: event.target.value || null }))
                  }
                >
                  <option value="">All materials</option>
                  {MATERIAL_FILTER_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Min price"
                placeholder="$0"
                inputMode="numeric"
                value={draft.minPrice}
                onChange={(e) => setDraft((prev) => ({ ...prev, minPrice: e.target.value }))}
              />
              <Input
                label="Max price"
                placeholder="$2500"
                inputMode="numeric"
                value={draft.maxPrice}
                onChange={(e) => setDraft((prev) => ({ ...prev, maxPrice: e.target.value }))}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
              <div>
                <p className="text-sm font-medium">Ready to ship</p>
                <p className="text-xs text-muted">Show pieces available to ship now</p>
              </div>
              <button
                type="button"
                className={cn(
                  "h-5 w-10 rounded-full border border-border bg-contrast transition",
                  draft.availability ? "border-ink bg-ink" : "",
                )}
                role="switch"
                aria-checked={draft.availability}
                onClick={() =>
                  setDraft((prev) => ({ ...prev, availability: !prev.availability }))
                }
              >
                <span
                  className={cn(
                    "block h-4 w-4 translate-x-0.5 rounded-full bg-surface transition",
                    draft.availability && "translate-x-5",
                  )}
                />
              </button>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={handleClear}>
              Clear all
            </Button>
            <div className="flex gap-2">
              <Dialog.Close asChild>
                <Button variant="subtle" size="sm">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button variant="primary" size="sm" onClick={handleApply}>
                Apply filters
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
