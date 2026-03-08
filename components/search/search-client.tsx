"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock, Search, X } from "lucide-react";
import { trackEvent } from "@/lib/analytics/client";
import { useSearchSuggestions } from "@/lib/hooks/useSearchSuggestions";
import { Price } from "@/components/ui/price";
import { useToast } from "@/lib/hooks/useToast";
import { getProductPrice } from "@/lib/utils/pricing";
import { resolveImageUrl } from "@/lib/utils/image";
import { getBrandInfo } from "@/lib/utils/brands";

const trendingPills = ["Chanel tweed", "Dior silk", "Gucci jacquard", "Loro Piana coating", "Fendi upholstery", "In stock"];

const RECENT_KEY = "atelier-fabrics-recent-searches";

export function SearchClient() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = window.localStorage.getItem(RECENT_KEY);
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const { data: suggestions, isFetching, isError, error } = useSearchSuggestions(query);
  const { toast } = useToast();

  useEffect(() => {
    if (!isError) return;
    const message = error instanceof Error ? error.message : "Unable to load suggestions right now.";
    toast({
      title: "Search is unavailable",
      description: message,
      variant: "error",
    });
  }, [error, isError, toast]);

  const saveRecent = (term: string) => {
    const normalized = term.trim();
    if (!normalized) return;
    const next = [normalized, ...recent.filter((item) => item.toLowerCase() !== normalized.toLowerCase())].slice(0, 6);
    setRecent(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    }
  };

  const clearRecent = () => {
    setRecent([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(RECENT_KEY);
    }
  };

  const removeRecent = (term: string) => {
    const next = recent.filter((item) => item !== term);
    setRecent(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    }
  };

  const handleSubmit = (term: string, source = "typed") => {
    const normalized = term.trim();
    if (!normalized) return;
    trackEvent("search_submit", { query: normalized, source });
    saveRecent(normalized);
    router.push(`/search/results?q=${encodeURIComponent(normalized)}`);
  };

  const hasSuggestions =
    (suggestions?.products?.length ?? 0) > 0 ||
    (suggestions?.categories?.length ?? 0) > 0 ||
    (suggestions?.brands?.length ?? 0) > 0;
  const showSuggestions = query.trim().length > 0 && hasSuggestions;

  const chips = useMemo(() => recent, [recent]);

  return (
    <div className="relative min-h-screen bg-background text-ink">
      <div className="absolute inset-0 bg-gradient-to-b from-ink/6 via-transparent to-transparent" />
      <div className="relative mx-auto flex h-screen max-w-4xl flex-col px-4 pb-8 pt-6 sm:px-6">
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
                if (e.key === "Enter") handleSubmit(query, "typed");
              }}
              autoFocus
              placeholder="Search fabric type, brand, weave, color..."
              className="w-full rounded-full border border-border bg-surface px-11 py-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-contrast p-2 text-muted transition hover:text-ink"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="text-sm font-medium text-muted hover:text-ink"
          >
            Cancel
          </button>
        </header>

        <div className="flex-1 overflow-y-auto pb-20">
          {isFetching && (
            <p className="mb-3 text-xs uppercase tracking-[0.18em] text-muted">Searching the edit...</p>
          )}

          <section className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl">Trending now</h2>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Fabric picks</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {trendingPills.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="rounded-full border border-border bg-contrast px-4 py-2 text-sm text-ink transition hover:border-ink"
                  onClick={() => {
                    setQuery(item);
                    handleSubmit(item, "trending");
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          </section>

          {chips.length > 0 && (
            <section className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-xl">Recent searches</h2>
                <button
                  type="button"
                  onClick={clearRecent}
                  className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted hover:text-ink"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {chips.map((item) => (
                  <div
                    key={item}
                    className="group flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink"
                  >
                    <button
                      type="button"
                      className="flex items-center gap-1 text-ink"
                      onClick={() => handleSubmit(item, "recent")}
                    >
                      <Clock size={14} className="text-muted" />
                      <span>{item}</span>
                    </button>
                    <button
                      type="button"
                      className="rounded-full p-1 text-muted transition hover:text-ink"
                      onClick={() => removeRecent(item)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {showSuggestions && (
            <section className="mb-8 space-y-4">
              <Group title="Products" show={Boolean(suggestions?.products?.length)}>
                <div className="grid grid-cols-1 gap-3">
                  {suggestions?.products?.map((product) => {
                    const cover = product.images.find((img) => img.isCover) ?? product.images[0];
                    const coverUrl = resolveImageUrl(cover?.url);
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => {
                          trackEvent("search_suggestion_product_click", {
                            productId: product.id,
                            slug: product.slug,
                          });
                          router.push(`/product/${product.slug}`);
                        }}
                        className="group flex items-center gap-3 rounded-lg border border-border bg-surface p-3 text-left transition hover:border-ink"
                      >
                        <div className="relative h-14 w-14 overflow-hidden rounded-md bg-contrast">
                          {coverUrl && (
                            <Image
                              src={coverUrl}
                              alt={cover?.alt ?? product.titleEn}
                              fill
                              sizes="56px"
                              className="object-cover transition duration-300 group-hover:scale-[1.03]"
                            />
                          )}
                        </div>
                        <div className="flex flex-1 flex-col">
                          <span className="text-sm font-medium">{product.titleEn}</span>
                          <span className="text-xs uppercase tracking-[0.16em] text-muted">
                            {product.category?.nameEn ?? "Product"}
                          </span>
                        </div>
                        <Price amount={getProductPrice(product)} currency={product.currency} className="text-sm" />
                      </button>
                    );
                  })}
                </div>
              </Group>

              <Group title="Brands" show={Boolean(suggestions?.brands?.length)}>
                <div className="flex flex-wrap gap-2">
                  {suggestions?.brands?.map((brand) => {
                    const brandLabel = getBrandInfo({ tags: [brand] })?.label ?? brand;
                    return (
                    <button
                      key={brand}
                      type="button"
                      className="rounded-full border border-border bg-contrast px-3 py-2 text-xs uppercase tracking-[0.18em] text-ink"
                      onClick={() => handleSubmit(brand, "brand")}
                    >
                      {brandLabel}
                    </button>
                    );
                  })}
                </div>
              </Group>

              <Group title="Categories" show={Boolean(suggestions?.categories?.length)}>
                <div className="flex flex-wrap gap-2">
                  {suggestions?.categories?.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className="rounded-full border border-border bg-contrast px-3 py-2 text-sm text-ink"
                      onClick={() => handleSubmit(category.nameEn, "category")}
                    >
                      {category.nameEn}
                    </button>
                  ))}
                </div>
              </Group>
            </section>
          )}

          {!hasSuggestions && query && !isFetching && (
            <p className="text-sm text-muted">Keep typing to see curated suggestions.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Group({
  title,
  children,
  show,
}: {
  title: string;
  children: React.ReactNode;
  show?: boolean;
}) {
  if (!show) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">{title}</p>
      {children}
    </div>
  );
}
