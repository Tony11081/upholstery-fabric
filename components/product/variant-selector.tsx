"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils/cn";

type ProductVariant = {
  id: string;
  color: string | null;
  size: string | null;
  inventory: number;
  price: number | null;
};

type VariantSelectorProps = {
  variants: ProductVariant[];
  onVariantChange?: (variant: ProductVariant | null) => void;
  className?: string;
};

export function VariantSelector({ variants, onVariantChange, className }: VariantSelectorProps) {
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  // Extract unique colors and sizes
  const colors = useMemo(() => {
    const uniqueColors = new Set<string>();
    variants.forEach((v) => {
      if (v.color) uniqueColors.add(v.color);
    });
    return Array.from(uniqueColors).sort();
  }, [variants]);

  const sizes = useMemo(() => {
    const uniqueSizes = new Set<string>();
    variants.forEach((v) => {
      if (v.size) uniqueSizes.add(v.size);
    });
    return Array.from(uniqueSizes).sort();
  }, [variants]);

  // Get available sizes for selected color
  const availableSizes = useMemo(() => {
    if (!selectedColor) return sizes;
    return sizes.filter((size) =>
      variants.some((v) => v.color === selectedColor && v.size === size && v.inventory > 0)
    );
  }, [selectedColor, sizes, variants]);

  // Get available colors for selected size
  const availableColors = useMemo(() => {
    if (!selectedSize) return colors;
    return colors.filter((color) =>
      variants.some((v) => v.size === selectedSize && v.color === color && v.inventory > 0)
    );
  }, [selectedSize, colors, variants]);

  // Find matching variant
  const selectedVariant = useMemo(() => {
    if (!selectedColor && !selectedSize) {
      // Return first available variant if no selection
      return variants.find((v) => v.inventory > 0) || variants[0] || null;
    }
    return (
      variants.find((v) => {
        const colorMatch = !selectedColor || v.color === selectedColor;
        const sizeMatch = !selectedSize || v.size === selectedSize;
        return colorMatch && sizeMatch;
      }) || null
    );
  }, [selectedColor, selectedSize, variants]);

  // Notify parent of variant change
  useMemo(() => {
    onVariantChange?.(selectedVariant);
  }, [selectedVariant, onVariantChange]);

  const handleColorSelect = (color: string) => {
    setSelectedColor(color === selectedColor ? null : color);
  };

  const handleSizeSelect = (size: string) => {
    setSelectedSize(size === selectedSize ? null : size);
  };

  if (colors.length === 0 && sizes.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-6", className)}>
      {colors.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium uppercase tracking-wider">Color</h3>
            {selectedColor && (
              <span className="text-sm text-muted">{selectedColor}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => {
              const isSelected = selectedColor === color;
              const isAvailable = availableColors.includes(color);
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleColorSelect(color)}
                  disabled={!isAvailable}
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm transition",
                    isSelected
                      ? "border-ink bg-ink text-surface"
                      : "border-border bg-surface text-ink hover:border-ink/50",
                    !isAvailable && "cursor-not-allowed opacity-40",
                  )}
                >
                  {color}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {sizes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium uppercase tracking-wider">Size</h3>
            {selectedSize && (
              <span className="text-sm text-muted">{selectedSize}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size) => {
              const isSelected = selectedSize === size;
              const isAvailable = availableSizes.includes(size);
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => handleSizeSelect(size)}
                  disabled={!isAvailable}
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm transition",
                    isSelected
                      ? "border-ink bg-ink text-surface"
                      : "border-border bg-surface text-ink hover:border-ink/50",
                    !isAvailable && "cursor-not-allowed opacity-40",
                  )}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedVariant && selectedVariant.inventory === 0 && (
        <p className="text-sm text-muted">This variant is currently out of stock</p>
      )}
    </div>
  );
}
