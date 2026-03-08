"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import { trackEvent } from "@/lib/analytics/client";
import { useInfiniteProducts } from "@/lib/hooks/useInfiniteProducts";
import { MasonryGrid } from "@/components/home/masonry-grid";
import { useToast } from "@/lib/hooks/useToast";
import { Skeleton } from "@/components/ui/skeleton";

export function SearchResultsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const {
    data,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    error,
    refetch,
  } = useInfiniteProducts({ q: query, limit: 30 });
  const { toast } = useToast();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const products = useMemo(() => data?.pages.flat() ?? [], [data]);
  const isInitialLoading = isFetching && products.length === 0;

  useEffect(() => {
    if (!isError) return;
    const message = error instanceof Error ? error.message : "Unable to load results right now.";
    toast({
      title: "Search is unavailable",
      description: message,
      variant: "error",
    });
  }, [error, isError, toast]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!query || isFetching) return;
    trackEvent("search_results_view", { query, results: products.length });
  }, [query, products.length, isFetching]);

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

  const handleSubmit = (term: string) => {
    const normalized = term.trim();
    if (!normalized) return;
    trackEvent("search_submit", { query: normalized, source: "results" });
    const params = new URLSearchParams(searchParams.toString());
    params.set("q", normalized);
    router.replace(`/search/results?${params.toString()}`);
  };

  return (
    <main className="min-h-screen bg-background text-ink">
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 md:px-8">
        <header className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full border border-border bg-surface px-3 py-2 text-sm text-muted transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit(query);
              }}
              className="w-full rounded-full border border-border bg-surface px-11 py-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink"
              placeholder="Refine your search"
            />
          </div>
        </header>

        <div className="mb-4 flex items-center justify-between text-sm text-muted">
          <span>
            Showing {products.length} curated {products.length === 1 ? "result" : "results"}
            {query ? ` for \"${query}\"` : ""}
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
          <div className="mt-4 flex items-center justify-center gap-3 rounded-xl border border-border bg-contrast px-4 py-3 text-xs uppercase tracking-[0.18em] text-muted">
            <Skeleton className="h-3 w-16" />
            <span>Loading more</span>
          </div>
        )}
        {!hasNextPage && products.length > 0 && (
          <div className="mt-4 text-center text-xs uppercase tracking-[0.18em] text-muted">
            You have reached the end of the results.
          </div>
        )}
      </div>
    </main>
  );
}
