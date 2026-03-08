"use client";

import { useMemo } from "react";
import type { ProductListItem } from "@/lib/data/products";
import { ProductCard } from "@/components/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { getBrandInfo } from "@/lib/utils/brands";

type GroupedGridProps = {
  products: ProductListItem[];
  isLoading?: boolean;
};

type ProductGroup = {
  key: string;
  brandLabel: string;
  categoryLabel: string;
  items: ProductListItem[];
};

function buildGroups(products: ProductListItem[]): ProductGroup[] {
  const groups: ProductGroup[] = [];
  const map = new Map<string, ProductGroup>();

  for (const product of products) {
    const brand = getBrandInfo({ tags: product.tags, titleEn: product.titleEn });
    const brandLabel = brand?.label ?? "Other";
    const brandKey = brand?.tag ?? "other";
    const categoryLabel = product.category?.nameEn ?? "Uncategorized";
    const categoryKey = product.category?.slug ?? "uncategorized";
    const key = `${brandKey}::${categoryKey}`;

    let group = map.get(key);
    if (!group) {
      group = {
        key,
        brandLabel,
        categoryLabel,
        items: [],
      };
      map.set(key, group);
      groups.push(group);
    }

    group.items.push(product);
  }

  return groups;
}

export function GroupedGrid({ products, isLoading }: GroupedGridProps) {
  const groups = useMemo(() => buildGroups(products), [products]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 2 }).map((_, groupIndex) => (
          <div
            key={groupIndex}
            className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)]"
          >
            <div className="space-y-2">
              <Skeleton className="h-3 w-28 rounded-md" />
              <Skeleton className="h-6 w-48 rounded-md" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((__, cardIndex) => (
                <div key={cardIndex} className="space-y-2">
                  <Skeleton className="aspect-[3/4] w-full rounded-lg" />
                  <Skeleton className="h-4 w-24 rounded-md" />
                  <Skeleton className="h-3 w-16 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface p-10 text-center text-sm text-muted">
        <p>No pieces match these filters yet.</p>
        <p className="mt-2 text-xs">Try clearing filters or switching tabs.</p>
      </div>
    );
  }

  if (!groups.length) {
    return null;
  }

  return (
    <div className="space-y-6">
      {groups.map((group, groupIndex) => (
        <section
          key={group.key}
          className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Brand / Category</p>
              <h3 className="font-display text-xl text-ink">
                {group.brandLabel}
                <span className="text-muted"> / </span>
                {group.categoryLabel}
              </h3>
            </div>
            <span className="rounded-full border border-border bg-contrast px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-muted">
              {group.items.length} pieces
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
            {group.items.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                className="h-full"
                priority={groupIndex === 0 && index < 2}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
