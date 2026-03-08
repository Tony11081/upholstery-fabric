"use client";

import { MasonryGrid } from "@/components/home/masonry-grid";
import { useProducts } from "@/lib/hooks/useProducts";
import type { ProductListItem } from "@/lib/data/products";

type HomeRecommendationsProps = {
  initialCurated?: ProductListItem[];
  initialReady?: ProductListItem[];
};

export function HomeRecommendations({ initialCurated = [], initialReady = [] }: HomeRecommendationsProps) {
  const {
    data: curated = [],
    isFetching: curatedLoading,
  } = useProducts(
    { sort: "popular", limit: 6 },
    { initialData: initialCurated, staleTime: 60_000 },
  );
  const {
    data: ready = [],
    isFetching: readyLoading,
  } = useProducts(
    { availability: "in_stock", sort: "ready", limit: 6 },
    { initialData: initialReady, staleTime: 60_000 },
  );

  const showCurated = curatedLoading || curated.length > 0;
  const showReady = readyLoading || ready.length > 0;

  if (!showCurated && !showReady) return null;

  return (
    <div className="space-y-6">
      {showCurated && (
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Curated archive</p>
            <h2 className="font-display text-2xl">Recommended fabrics</h2>
            <p className="text-sm text-muted">
              Popular designer textile lots across fabric families, refreshed daily.
            </p>
          </div>
          <div className="mt-4">
            <MasonryGrid products={curated} isLoading={curatedLoading} view="shop" />
          </div>
        </section>
      )}

      {showReady && (
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">In stock</p>
            <h2 className="font-display text-2xl">Available yardage</h2>
            <p className="text-sm text-muted">
              Fabric lots with immediate availability for swatch or meter orders.
            </p>
          </div>
          <div className="mt-4">
            <MasonryGrid products={ready} isLoading={readyLoading} view="shop" />
          </div>
        </section>
      )}
    </div>
  );
}
