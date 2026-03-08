"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Brand = {
  id: string;
  name: string;
  slug: string;
  _count?: {
    products: number;
  };
};

type BrandFilterProps = {
  brands: Brand[];
  selectedBrand?: string | null;
  className?: string;
  maxVisible?: number;
};

export function BrandFilter({ brands, selectedBrand, className, maxVisible = 10 }: BrandFilterProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleBrands = expanded ? brands : brands.slice(0, maxVisible);
  const hasMore = brands.length > maxVisible;

  return (
    <div className={cn("space-y-3", className)}>
      <h3 className="text-sm font-medium uppercase tracking-wider">Brands</h3>
      <div className="space-y-2">
        {visibleBrands.map((brand) => {
          const isSelected = selectedBrand === brand.slug;
          return (
            <Link
              key={brand.id}
              href={`/brands/${brand.slug}`}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition hover:bg-surface",
                isSelected && "bg-surface font-medium",
              )}
            >
              <span>{brand.name}</span>
              {brand._count && (
                <span className="text-xs text-muted">
                  {brand._count.products}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm text-muted hover:text-ink transition"
        >
          {expanded ? (
            <>
              Show less <ChevronUp size={16} />
            </>
          ) : (
            <>
              Show all ({brands.length}) <ChevronDown size={16} />
            </>
          )}
        </button>
      )}
    </div>
  );
}
