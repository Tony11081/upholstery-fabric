"use client";

import { Heart, Play, ShoppingBag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Price } from "@/components/ui/price";
import type { ProductListItem } from "@/lib/data/products";
import { cn } from "@/lib/utils/cn";
import { resolveImageUrl } from "@/lib/utils/image";
import { getProductPrice } from "@/lib/utils/pricing";
import { Skeleton } from "@/components/ui/skeleton";
import { useBagStore } from "@/lib/state/bag-store";
import { useToast } from "@/lib/hooks/useToast";
import { useWishlistStore } from "@/lib/state/wishlist-store";
import { getBrandInfo } from "@/lib/utils/brands";

type ProductCardProps = {
  product: ProductListItem;
  className?: string;
  href?: string;
  showBadges?: boolean;
  priority?: boolean;
  prefetch?: boolean;
};

export function ProductCard({
  product,
  className,
  href,
  showBadges = true,
  priority = false,
  prefetch,
}: ProductCardProps) {
  const cover = product.images.find((image) => image.isCover) ?? product.images[0];
  const coverUrl = resolveImageUrl(cover?.url);
  const rawCoverUrl = cover?.url ?? null;
  const price = getProductPrice(product);
  const isVideo = product.tags.includes("video");
  const [loaded, setLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [useRawCover, setUseRawCover] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const addItem = useBagStore((s) => s.addItem);
  const toast = useToast();
  const linkHref = href ?? `/product/${product.slug}`;
  const shouldPrefetch = prefetch ?? priority;
  const wishlistIds = useWishlistStore((s) => s.productIds);
  const wishlistHydrated = useWishlistStore((s) => s.hydrated);
  const wishlistSignedIn = useWishlistStore((s) => s.signedIn);
  const wishlistLoad = useWishlistStore((s) => s.load);
  const wishlistAddLocal = useWishlistStore((s) => s.addLocal);
  const wishlistRemoveLocal = useWishlistStore((s) => s.removeLocal);

  const metaTag = product.tags.find((tag) => !["video", "editorial"].includes(tag));
  const meta = metaTag ? formatTag(metaTag) : null;
  const availabilityLabel = product.inventory > 0 ? "Ready to ship" : "Backorder";
  const resolvedCoverUrl = useRawCover ? rawCoverUrl : coverUrl;

  const isWishlisted = wishlistIds.includes(product.id);

  useEffect(() => {
    if (!wishlistHydrated) {
      void wishlistLoad();
    }
  }, [wishlistHydrated, wishlistLoad]);

  useEffect(() => {
    setLoaded(false);
    setImageError(false);
    setUseRawCover(false);
  }, [product.id, coverUrl]);

  const handleQuickAdd = () => {
    addItem({
      productId: product.id,
      slug: product.slug,
      title: product.titleEn,
      price,
      currency: product.currency,
      quantity: 1,
      image: coverUrl ?? cover?.url ?? undefined,
    });
    toast.success("Added to bag", product.titleEn);
  };

  const handleWishlistToggle = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (wishlistBusy) return;
    if (wishlistSignedIn === false) {
      toast.error("Sign in required", "Create an account to save favorites.");
      return;
    }
    setWishlistBusy(true);
    try {
      const res = await fetch("/api/wishlist", {
        method: isWishlisted ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      });
      if (res.status === 401) {
        toast.error("Sign in required", "Create an account to save favorites.");
        return;
      }
      if (!res.ok) {
        throw new Error("Unable to update wishlist");
      }
      if (isWishlisted) {
        wishlistRemoveLocal(product.id);
        toast.success("Removed from wishlist", product.titleEn);
      } else {
        wishlistAddLocal(product.id);
        toast.success("Saved to wishlist", product.titleEn);
      }
    } catch (error) {
      toast.error("Unable to update wishlist", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setWishlistBusy(false);
    }
  };

  return (
    <div
      className={cn("group flex flex-col gap-3 text-ink", className)}
    >
      <Link href={linkHref} className="flex flex-col gap-3 touch-manipulation" prefetch={shouldPrefetch}>
        <div className="relative overflow-hidden rounded-lg border border-border bg-surface">
          <div className="relative aspect-[3/4]">
            {!loaded && <Skeleton className="absolute inset-0 rounded-none" />}
            {resolvedCoverUrl && !imageError ? (
              <Image
                src={resolvedCoverUrl}
                alt={cover?.alt ?? product.titleEn}
                fill
                sizes="(min-width: 1024px) 320px, 50vw"
                className={cn(
                  "object-cover transition duration-500 group-hover:scale-[1.02]",
                  loaded ? "opacity-100" : "opacity-0",
                )}
                onLoadingComplete={() => setLoaded(true)}
                onError={() => {
                  if (!useRawCover && rawCoverUrl && rawCoverUrl !== coverUrl) {
                    setUseRawCover(true);
                    return;
                  }
                  setImageError(true);
                  setLoaded(true);
                }}
                priority={priority}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-contrast text-sm text-muted">
                Image unavailable
              </div>
            )}
          </div>

          <div className="absolute right-3 top-3 flex flex-col gap-2">
            <WishlistButton
              active={isWishlisted}
              busy={wishlistBusy}
              onClick={handleWishlistToggle}
            />
            {isVideo && (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/75 text-surface backdrop-blur">
                <Play size={16} />
              </span>
            )}
          </div>

          {showBadges && (
            <div className="absolute left-3 top-3 flex flex-wrap gap-2">
              {product.isNew && <Badge tone="accent">New</Badge>}
              {product.isBestSeller && <Badge tone="solid">Best seller</Badge>}
            </div>
          )}
        </div>
      </Link>

      <div className="relative">
        <Link href={linkHref} className="block space-y-1 pr-10 touch-manipulation" prefetch={shouldPrefetch}>
          <Price amount={price} currency={product.currency} className="text-sm font-medium" />
          <h3 className="font-display text-lg leading-[1.2] line-clamp-2">{product.titleEn}</h3>
          <p className="text-[12px] uppercase tracking-[0.18em] text-muted">
            {meta ?? product.category?.nameEn ?? "Product"}
          </p>
          <p className="text-[12px] text-muted">
            <span className="mr-1 text-[16px] align-middle">|</span>
            {availabilityLabel}
          </p>
        </Link>

        <button
          type="button"
          onClick={handleQuickAdd}
          aria-label="Add to bag"
          className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-ink shadow-sm transition hover:border-ink/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink touch-manipulation"
        >
          <ShoppingBag size={16} />
        </button>
      </div>
    </div>
  );
}

type WishlistButtonProps = {
  active: boolean;
  busy: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

function WishlistButton({ active, busy, onClick }: WishlistButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? "Remove from wishlist" : "Save to wishlist"}
      aria-pressed={active}
      disabled={busy}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-ink shadow-[var(--shadow-float)] backdrop-blur transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:cursor-not-allowed disabled:opacity-70 touch-manipulation",
        active ? "border border-ink/60" : "border border-transparent",
      )}
    >
      <Heart
        size={16}
        className={cn("transition", active ? "fill-ink text-ink" : "text-ink/70")}
      />
    </button>
  );
}

function formatTag(tag: string) {
  const brand = getBrandInfo({ tags: [tag] });
  if (brand?.label) return brand.label;
  return tag
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
