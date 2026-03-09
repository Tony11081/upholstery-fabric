"use client";

import { useEffect, useMemo, useRef } from "react";
import { MasonryGrid } from "@/components/home/masonry-grid";
import { Skeleton } from "@/components/ui/skeleton";
import { useInfiniteProducts } from "@/lib/hooks/useInfiniteProducts";
import { useToast } from "@/lib/hooks/useToast";
import type { ProductListItem } from "@/lib/data/products";

type Props = {
  slug: string;
  name: string;
  initialProducts?: ProductListItem[];
};

export function CategoryClient({ slug, name, initialProducts = [] }: Props) {
  const { data, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage, isError, error, refetch } =
    useInfiniteProducts({ category: slug, limit: 30 }, { initialData: initialProducts });
  const { toast } = useToast();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const products = useMemo(() => data?.pages.flat() ?? [], [data]);
  const isInitialLoading = isFetching && products.length === 0;

  useEffect(() => {
    if (!isError) return;
    const message = error instanceof Error ? error.message : "Unable to load this category right now.";
    toast({
      title: "Category refreshing",
      description: message,
      variant: "error",
    });
  }, [error, isError, toast]);

  useEffect(() => {
    if (!hasNextPage) return;
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Showing {products.length} {products.length === 1 ? "piece" : "pieces"} in {name}
        </span>
        {isError && (
          <button
            type="button"
            onClick={() => refetch()}
            className="text-xs uppercase tracking-[0.18em] text-ink underline underline-offset-4"
          >
            Refresh
          </button>
        )}
      </div>
      <MasonryGrid products={products} isLoading={isInitialLoading} view="shop" />
      <div ref={loadMoreRef} className="h-1" />
      {isFetchingNextPage && (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-contrast px-4 py-3 text-xs uppercase tracking-[0.18em] text-muted">
          <Skeleton className="h-3 w-16" />
          <span>Loading more</span>
        </div>
      )}
      {!hasNextPage && products.length > 0 && (
        <div className="text-center text-xs uppercase tracking-[0.18em] text-muted">
          You have reached the end of this category.
        </div>
      )}
    </div>
  );
}
