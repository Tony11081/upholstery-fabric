"use client";

import type { ProductListItem } from "@/lib/data/products";
import { ProductCard } from "@/components/product-card";
import { Skeleton } from "@/components/ui/skeleton";

type MasonryGridProps = {
  products: ProductListItem[];
  isLoading?: boolean;
  view: "editorial" | "shop";
};

export function MasonryGrid({ products, isLoading, view }: MasonryGridProps) {
  const skeletonItems = Array.from({ length: 6 });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:block md:columns-3 md:[column-gap:1rem]">
        {skeletonItems.map((_, idx) => (
          <div key={idx} className="mb-4 break-inside-avoid">
            <Skeleton className="aspect-[3/4] w-full rounded-lg" />
            <div className="mt-3 space-y-2">
              <Skeleton className="h-4 w-16 rounded-md" />
              <Skeleton className="h-5 w-full rounded-md" />
              <Skeleton className="h-3 w-24 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface p-10 text-center text-sm text-muted">
        <p>No items match these filters yet.</p>
        <p className="mt-2 text-xs">Try resetting filters or switching tabs.</p>
      </div>
    );
  }

  if (view === "shop") {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {products.map((product, index) => (
          <ProductCard key={product.id} product={product} className="h-full" priority={index < 4} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:block md:columns-3 md:[column-gap:1rem]">
      {products.map((product, index) => (
        <div key={product.id} className="mb-4 break-inside-avoid">
          <ProductCard product={product} priority={index < 4} />
        </div>
      ))}
    </div>
  );
}
