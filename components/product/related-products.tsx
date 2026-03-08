"use client";

import type { ProductListItem } from "@/lib/data/products";
import { ProductCard } from "@/components/product-card";

type RelatedProductsProps = {
  title: string;
  subtitle?: string;
  products: ProductListItem[];
};

export function RelatedProducts({ title, subtitle, products }: RelatedProductsProps) {
  if (!products.length) return null;

  return (
    <section className="mt-10 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Recommended</p>
        <h2 className="font-display text-2xl">{title}</h2>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product, index) => (
          <ProductCard key={product.id} product={product} priority={index < 4} className="h-full" />
        ))}
      </div>
    </section>
  );
}
