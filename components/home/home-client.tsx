"use client";

import { format } from "date-fns";
import type { Category } from "@prisma/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Filter, ShieldCheck, Sparkles, Truck, Share2, MessageCircle } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { MasonryGrid } from "@/components/home/masonry-grid";
import { GroupedGrid } from "@/components/home/grouped-grid";
import { Tabs } from "@/components/home/tabs";
import { ViewToggle } from "@/components/home/view-toggle";
import { SortMenu, type SortOption } from "@/components/home/sort-menu";
import { HomeHero } from "@/components/home/home-hero";
import { StyleQuiz } from "@/components/recommendations/style-quiz";
import { HomeRecommendations } from "@/components/home/home-recommendations";
import { useInfiniteProducts } from "@/lib/hooks/useInfiniteProducts";
import { cn } from "@/lib/utils/cn";
import { Chip } from "@/components/ui/chip";
import { getBrandInfo } from "@/lib/utils/brands";
import { useToast } from "@/lib/hooks/useToast";
import { trackEvent } from "@/lib/analytics/client";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProductListItem } from "@/lib/data/products";
import { CATALOG_GROUP_OPTIONS } from "@/lib/utils/catalog-filters";

type HomeClientProps = {
  categories: Category[];
  stats: {
    total: number;
    newCount: number;
    lastUpdated: string | null;
  };
  initialRecommendations: {
    curated: ProductListItem[];
    ready: ProductListItem[];
  };
};

const sortOptions: SortOption[] = [
  { label: "Category mix", value: "category_mix" },
  { label: "Newest", value: "newest" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
  { label: "Popular", value: "popular" },
  { label: "In stock", value: "ready" },
];

type FiltersState = {
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

const VALUE_PROPS = [
  {
    icon: ShieldCheck,
    title: "Fabric inspection",
    body: "Every lot is checked for weave, handfeel, color consistency, and visible defects.",
  },
  {
    icon: Sparkles,
    title: "Luxury mill selection",
    body: "Fresh archive fabrics across tweed, silk, jacquard, coating, lining, and upholstery.",
  },
  {
    icon: Truck,
    title: "Tracked delivery",
    body: "Swatch and yardage orders include delivery updates after payment.",
  },
] as const;

const FilterModal = dynamic(
  () => import("@/components/home/filter-modal").then((mod) => mod.FilterModal),
  { ssr: false },
);

export function HomeClient({ categories, stats, initialRecommendations }: HomeClientProps) {
  const [tab, setTab] = useState<"all" | "new" | "videos" | "editorial">("all");
  const [view, setView] = useState<"editorial" | "shop" | "grouped">("editorial");
  const [sort, setSort] = useState<string>("category_mix");
  const [filterOpen, setFilterOpen] = useState(false);
  const [brands, setBrands] = useState<string[]>([]);
  const [filters, setFilters] = useState<FiltersState>({
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
  const [subscribeEmail, setSubscribeEmail] = useState("");
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [subscribeSent, setSubscribeSent] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/brands")
      .then((res) => res.json())
      .then((data) => setBrands(data.brands || []))
      .catch(() => setBrands([]));
  }, []);

  const queryParams = useMemo(() => {
    const minPrice = filters.minPrice ? Number(filters.minPrice) : null;
    const maxPrice = filters.maxPrice ? Number(filters.maxPrice) : null;
    const tag = tab === "videos" ? "video" : tab === "editorial" ? "editorial" : undefined;

    return {
      category: filters.category ?? undefined,
      categoryGroup: filters.categoryGroup ?? undefined,
      brand: filters.brand ?? undefined,
      color: filters.color ?? undefined,
      size: filters.size ?? undefined,
      material: filters.material ?? undefined,
      sort,
      isNew: tab === "new",
      tag,
      minPrice,
      maxPrice,
      availability: filters.availability ? ("in_stock" as const) : undefined,
      limit: 30,
    };
  }, [filters, sort, tab]);

  const {
    data,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    error,
    refetch,
  } = useInfiniteProducts(queryParams);
  const products = useMemo(() => data?.pages.flat() ?? [], [data]);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isError) return;
    const message = error instanceof Error ? error.message : "Unable to load products.";
    toast({
      title: "Products unavailable",
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

  const lastUpdated = stats.lastUpdated ? format(new Date(stats.lastUpdated), "MMM d, yyyy") : "Today";
  const activeFilterCount =
    Number(Boolean(filters.category)) +
    Number(Boolean(filters.categoryGroup)) +
    Number(Boolean(filters.brand)) +
    Number(Boolean(filters.color)) +
    Number(Boolean(filters.size)) +
    Number(Boolean(filters.material)) +
    Number(Boolean(filters.minPrice)) +
    Number(Boolean(filters.maxPrice)) +
    Number(Boolean(filters.availability));
  const isInitialLoading = isFetching && products.length === 0;
  const visibleCategories = categories.slice(0, 8);
  const visibleBrands = brands.slice(0, 8);
  const featuredCategories = categories.slice(0, 6);

  const handleSubscribe = async () => {
    if (!subscribeEmail.trim()) {
      toast({ title: "Email required", description: "Enter your email to subscribe.", variant: "error" });
      return;
    }
    if (subscribeLoading) return;
    setSubscribeLoading(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "NEW_ARRIVAL", email: subscribeEmail }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to subscribe");
      }
      setSubscribeSent(true);
      trackEvent("new_arrival_subscribed", { source: "home" }, subscribeEmail);
      toast({ title: "Subscribed", description: "You'll receive new arrival updates.", variant: "success" });
    } catch (error) {
      toast({ title: "Unable to subscribe", description: error instanceof Error ? error.message : "Try again later.", variant: "error" });
    } finally {
      setSubscribeLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-24 pt-2 sm:px-6 md:px-8">
      <HomeHero stats={{ ...stats, lastUpdated: stats.lastUpdated ? new Date(stats.lastUpdated) : null }} />
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Subscriptions</p>
          <h2 className="font-display text-2xl">New fabric alerts</h2>
          <p className="text-sm text-muted">
            Receive new archive yardage drops, swatch updates, and limited mill finds.
          </p>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            placeholder="Email address"
            value={subscribeEmail}
            onChange={(event) => setSubscribeEmail(event.target.value)}
            className="w-full rounded-full border border-border bg-background px-4 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleSubscribe}
            disabled={subscribeLoading || subscribeSent}
            className="rounded-full border border-border bg-contrast px-4 py-2 text-sm font-medium text-ink transition hover:border-ink/60 disabled:opacity-60"
          >
            {subscribeSent ? "Subscribed" : "Subscribe"}
          </button>
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Quick categories</p>
          <Link
            href="/categories"
            className="text-xs uppercase tracking-[0.18em] text-ink underline underline-offset-4"
          >
            View all
          </Link>
        </div>
        <div className="mt-3 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 pr-8 touch-pan-x">
          {CATALOG_GROUP_OPTIONS.map((group) => (
            <Chip
              key={group.value}
              active={(filters.categoryGroup ?? "all") === group.value}
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  categoryGroup: group.value === "all" ? null : group.value,
                }))
              }
              className="shrink-0"
            >
              {group.label}
            </Chip>
          ))}
        </div>
        <div className="mt-3 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 pr-8 touch-pan-x">
          <Chip
            active={!filters.category}
            onClick={() => setFilters((prev) => ({ ...prev, category: null }))}
            className="shrink-0"
          >
            All
          </Chip>
          {featuredCategories.map((category) => (
            <Chip
              key={category.id}
              active={filters.category === category.slug}
              onClick={() => setFilters((prev) => ({ ...prev, category: category.slug }))}
              className="shrink-0"
            >
              {category.nameEn}
            </Chip>
          ))}
        </div>
      </section>
      <HomeRecommendations
        initialCurated={initialRecommendations.curated}
        initialReady={initialRecommendations.ready}
      />
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Categories</p>
            <h2 className="mt-2 font-display text-2xl">Explore the edit</h2>
            <p className="mt-1 text-xs text-muted">Start with a fabric family, then refine by brand, color, and material.</p>
          </div>
          <Link
            href="/categories"
            className="text-xs uppercase tracking-[0.18em] text-ink underline underline-offset-4"
          >
            View all
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {featuredCategories.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="group rounded-xl border border-border bg-contrast px-3 py-3 text-left transition hover:border-ink/60"
            >
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted">Category</p>
              <h3 className="mt-1 text-sm font-medium">{category.nameEn}</h3>
              <p className="mt-1 text-[11px] text-muted line-clamp-1">Designer fabric lots, swatches, and yardage availability.</p>
            </Link>
          ))}
        </div>
      </section>
      <section>
        <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible">
          {VALUE_PROPS.map((item) => (
            <div
              key={item.title}
              className="min-w-[220px] rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)] md:min-w-0 md:p-5"
            >
              <div className="max-h-[22vh] overflow-hidden md:max-h-none">
                <item.icon className="text-ink" size={18} />
                <h3 className="mt-3 text-sm font-medium text-ink">{item.title}</h3>
                <p className="mt-2 text-xs text-muted line-clamp-2">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <StyleQuiz />

      <div id="catalog" className="rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted">
            <span className="font-semibold text-ink">New arrivals {stats.newCount.toLocaleString()}</span>
            <span className="text-muted">|</span>
            <span>Total fabrics {stats.total.toLocaleString()}</span>
            <span className="text-muted">|</span>
            <span>Updated {lastUpdated}</span>
          </div>
        </div>

        <Tabs value={tab} onChange={setTab} />

        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <ViewToggle view={view} onChange={setView} />
          <div className="flex items-center gap-2">
            <SortMenu options={sortOptions} value={sort} onChange={setSort} />
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className={cn(
                "flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-sm shadow-sm transition hover:border-ink/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink",
              )}
            >
              <Filter size={14} />
              <span>
                Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-4 pb-3">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted">Top categories</span>
            <div className="relative">
              <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-2 pr-8 touch-pan-x">
                <Chip
                  active={!filters.category}
                  onClick={() => setFilters((prev) => ({ ...prev, category: null }))}
                  className="shrink-0"
                >
                  All
                </Chip>
                {visibleCategories.map((category) => (
                  <Chip
                    key={category.id}
                    active={filters.category === category.slug}
                    onClick={() => setFilters((prev) => ({ ...prev, category: category.slug }))}
                    className="shrink-0"
                  >
                    {category.nameEn}
                  </Chip>
                ))}
                {categories.length > visibleCategories.length && (
                  <Chip onClick={() => setFilterOpen(true)} className="shrink-0 text-ink">
                    More
                  </Chip>
                )}
              </div>
              <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted">Top brands</span>
            <div className="relative">
              <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-2 pr-8 touch-pan-x">
                <Chip
                  active={!filters.brand}
                  onClick={() => setFilters((prev) => ({ ...prev, brand: null }))}
                  className="shrink-0"
                >
                  All
                </Chip>
                {visibleBrands.map((brand) => {
                  const brandLabel = getBrandInfo({ tags: [brand] })?.label ?? brand;
                  return (
                    <Chip
                      key={brand}
                      active={filters.brand === brand}
                      onClick={() => setFilters((prev) => ({ ...prev, brand }))}
                      className="shrink-0"
                    >
                      {brandLabel}
                    </Chip>
                  );
                })}
                {brands.length > visibleBrands.length && (
                  <Chip onClick={() => setFilterOpen(true)} className="shrink-0 text-ink">
                    More
                  </Chip>
                )}
              </div>
              <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent" />
            </div>
          </div>
        </div>

        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-4 pb-2 text-sm">
            {filters.category && (
              <FilterChip
                label={categories.find((c) => c.slug === filters.category)?.nameEn ?? filters.category}
                onClear={() => setFilters((prev) => ({ ...prev, category: null }))}
              />
            )}
            {filters.categoryGroup && (
              <FilterChip
                label={CATALOG_GROUP_OPTIONS.find((group) => group.value === filters.categoryGroup)?.label ?? filters.categoryGroup}
                onClear={() => setFilters((prev) => ({ ...prev, categoryGroup: null }))}
              />
            )}
            {filters.brand && (
              <FilterChip
                label={filters.brand}
                onClear={() => setFilters((prev) => ({ ...prev, brand: null }))}
              />
            )}
            {filters.color && (
              <FilterChip
                label={`Color ${filters.color}`}
                onClear={() => setFilters((prev) => ({ ...prev, color: null }))}
              />
            )}
            {filters.size && (
              <FilterChip
                label={`Size ${filters.size}`}
                onClear={() => setFilters((prev) => ({ ...prev, size: null }))}
              />
            )}
            {filters.material && (
              <FilterChip
                label={`Material ${filters.material}`}
                onClear={() => setFilters((prev) => ({ ...prev, material: null }))}
              />
            )}
            {filters.minPrice && (
              <FilterChip
                label={`Min $${filters.minPrice}`}
                onClear={() => setFilters((prev) => ({ ...prev, minPrice: "" }))}
              />
            )}
            {filters.maxPrice && (
              <FilterChip
                label={`Max $${filters.maxPrice}`}
                onClear={() => setFilters((prev) => ({ ...prev, maxPrice: "" }))}
              />
            )}
            {filters.availability && (
              <FilterChip label="Ready to ship" onClear={() => setFilters((prev) => ({ ...prev, availability: false }))} />
            )}
            <button
              type="button"
              className="text-xs font-medium uppercase tracking-[0.18em] text-muted underline-offset-4 hover:text-ink"
              onClick={() =>
                setFilters({
                  category: null,
                  categoryGroup: null,
                  brand: null,
                  color: null,
                  size: null,
                  material: null,
                  minPrice: "",
                  maxPrice: "",
                  availability: false,
                })
              }
            >
              Clear all
            </button>
          </div>
        )}

        {isError && (
          <div className="mx-4 mb-4 rounded-lg border border-border bg-contrast px-4 py-3 text-sm text-muted">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>Unable to load products right now.</span>
              <button
                type="button"
                onClick={() => refetch()}
                className="text-xs uppercase tracking-[0.18em] text-ink underline underline-offset-4"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        <div className="px-4 pb-6">
          {view === "grouped" ? (
            <GroupedGrid products={products} isLoading={isInitialLoading} />
          ) : (
            <MasonryGrid products={products} isLoading={isInitialLoading} view={view} />
          )}
          <div ref={loadMoreRef} className="h-1" />
          {isFetchingNextPage && (
            <div className="mt-4 flex items-center justify-center gap-3 rounded-xl border border-border bg-contrast px-4 py-3 text-xs uppercase tracking-[0.18em] text-muted">
              <Skeleton className="h-3 w-16" />
              <span>Loading more</span>
            </div>
          )}
          {!hasNextPage && products.length > 0 && (
            <div className="mt-4 text-center text-xs uppercase tracking-[0.18em] text-muted">
              You have reached the end of the curated catalog.
            </div>
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Support</p>
          <h2 className="font-display text-2xl">Need help before payment?</h2>
          <p className="text-sm text-muted">
            Reach concierge for size, stock, shipping, and payment help before checkout.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/help"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-contrast px-4 py-2 text-sm font-medium text-ink transition hover:border-ink/60"
          >
            <MessageCircle size={16} />
            Visit help center
          </Link>
          <a
            href="https://wa.me/8613462248923"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-contrast px-4 py-2 text-sm font-medium text-ink transition hover:border-ink/60"
          >
            <Share2 size={16} />
            WhatsApp concierge
          </a>
        </div>
      </section>

      {filterOpen && (
        <FilterModal
          open={filterOpen}
          onOpenChange={setFilterOpen}
          categories={categories}
          brands={brands}
          initial={filters}
          onApply={(value) => setFilters(value)}
          onClear={() =>
            setFilters({
              category: null,
              categoryGroup: null,
              brand: null,
              color: null,
              size: null,
              material: null,
              minPrice: "",
              maxPrice: "",
              availability: false,
            })
          }
        />
      )}
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <Chip
      active
      tone="accent"
      onClick={onClear}
      className="border-border bg-contrast text-ink"
      aria-label={`Clear ${label}`}
    >
      {label}
    </Chip>
  );
}
