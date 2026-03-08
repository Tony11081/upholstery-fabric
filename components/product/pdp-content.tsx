"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Truck, PhoneCall } from "lucide-react";
import type { ProductWithRelations } from "@/lib/data/products";
import { getProductPrice } from "@/lib/utils/pricing";
import { useDisplayPricing } from "@/lib/hooks/use-display-pricing";
import { useBagStore } from "@/lib/state/bag-store";
import { Button } from "@/components/ui/button";
import { PdpLightbox } from "@/components/product/pdp-lightbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/lib/hooks/useToast";
import { trackEvent } from "@/lib/analytics/client";
import { ConciergeCard } from "@/components/concierge/concierge-card";
import { AuthenticityPanel } from "@/components/trust/authenticity-panel";
import { ReturnsTimeline } from "@/components/trust/returns-timeline";
import { calculateShipping } from "@/lib/utils/shipping";
import { resolveImageUrl } from "@/lib/utils/image";
import { PromoGiftNote } from "@/components/promo/promo-gift-note";
import { PaymentMethods } from "@/components/ui/payment-methods";
import {
  extractColorOptionsFromText,
  extractColorsFromTags as extractColorsFromOptionTags,
  extractMaterialOptionsFromText,
  extractMaterialsFromTags,
  extractSizeOptionsFromText,
  extractSizesFromTags as extractSizesFromOptionTags,
} from "@/lib/utils/product-options";
import { getShippingDisplayProfile } from "@/lib/utils/display-content";

type Props = {
  product: ProductWithRelations;
};

export function PdpContent({ product }: Props) {
  const router = useRouter();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const hero = product.images[selectedImageIndex] ?? product.images[0];
  const gallery = product.images
    .map((img, index) => ({ img, index }))
    .filter(({ index }) => index !== selectedImageIndex);
  const images = product.images.map((img) => ({
    url: resolveImageUrl(img.url) ?? img.url,
    alt: img.alt ?? product.titleEn,
  }));
  const primaryImageUrl = resolveImageUrl(hero?.url ?? product.images[0]?.url);
  const heroUrl = primaryImageUrl;
  const price = getProductPrice(product);
  const shippingEstimate = calculateShipping(price);
  const orderTotal = price + shippingEstimate;
  const { profile, formatAmount } = useDisplayPricing();
  const shippingProfile = useMemo(
    () => getShippingDisplayProfile(profile.countryCode),
    [profile.countryCode],
  );
  const addItem = useBagStore((s) => s.addItem);
  const clearBag = useBagStore((s) => s.clear);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifySent, setNotifySent] = useState(false);
  const [priceDropEmail, setPriceDropEmail] = useState("");
  const [priceDropLoading, setPriceDropLoading] = useState(false);
  const [priceDropSent, setPriceDropSent] = useState(false);
  const [buyNowLoading, setBuyNowLoading] = useState(false);
  const optionGroups = useMemo(() => buildOptionGroups(product), [product]);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const selectedOptionsNormalized = useMemo(
    () => normalizeSelectedOptions(optionGroups, selectedOptions),
    [optionGroups, selectedOptions],
  );
  const optionSummary = useMemo(
    () => buildOptionSummary(optionGroups, selectedOptionsNormalized),
    [optionGroups, selectedOptionsNormalized],
  );
  const { toast } = useToast();

  const availability = product.inventory > 0 ? "Ready to ship" : "Backorder";
  const isOutOfStock = product.inventory <= 0;
  const reviews = product.reviews ?? [];
  const averageRating = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : null;
  const detailItems = buildDetailItems(product);
  const displayTitle = useMemo(
    () => buildStandardizedTitle(product, detailItems),
    [detailItems, product],
  );
  const productHighlights = useMemo(
    () => buildProductHighlights(product, detailItems),
    [detailItems, product],
  );
  const sizeGuideText = useMemo(
    () => buildSizeGuide(optionGroups, product),
    [optionGroups, product],
  );
  const colorImageIndex = useMemo(() => buildColorImageIndexMap(product), [product]);
  const trustItems = [
    { icon: ShieldCheck, label: "Secure hosted checkout" },
    { icon: Truck, label: "Global UPS 5-9 days" },
    { icon: PhoneCall, label: "Concierge support" },
  ];

  const handleOptionSelect = useCallback((groupId: string, value: string) => {
    setSelectedOptions((prev) => {
      if (prev[groupId] === value) return prev;
      return { ...prev, [groupId]: value };
    });
    if (groupId === "color") {
      const imageIndex = colorImageIndex.get(value.toLowerCase());
      if (typeof imageIndex === "number") {
        setSelectedImageIndex(imageIndex);
      }
    }
  }, [colorImageIndex]);

  useEffect(() => {
    if (!optionGroups.length) {
      setSelectedOptions((prev) => (Object.keys(prev).length ? {} : prev));
      return;
    }
    setSelectedOptions((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const group of optionGroups) {
        const current = prev[group.id];
        if (!current || !group.values.includes(current)) {
          next[group.id] = group.values[0];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [optionGroups]);

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [product.id]);

  const handleAdd = () => {
    if (isOutOfStock) return;
    addItem({
      productId: product.id,
      slug: product.slug,
      title: displayTitle,
      price: price,
      currency: product.currency,
      quantity: 1,
      image: primaryImageUrl ?? product.images[0]?.url,
      badge: optionSummary || undefined,
      options: selectedOptionsNormalized,
    });
    trackEvent("add_to_bag", {
      productId: product.id,
      slug: product.slug,
      price,
      currency: product.currency,
      options: selectedOptionsNormalized ?? null,
    });
    toast({
      title: "Added to bag",
      description: displayTitle,
      variant: "success",
    });
  };

  const handleBuyNow = () => {
    if (isOutOfStock || buyNowLoading) return;
    setBuyNowLoading(true);
    trackEvent("checkout_started", {
      productId: product.id,
      slug: product.slug,
      source: "pdp_buy_now",
      options: selectedOptionsNormalized ?? null,
    });

    try {
      clearBag();
      addItem({
        productId: product.id,
        slug: product.slug,
        title: displayTitle,
        price: price,
        currency: product.currency,
        quantity: 1,
        image: primaryImageUrl ?? product.images[0]?.url,
        badge: optionSummary || undefined,
        options: selectedOptionsNormalized,
      });
      router.push("/checkout/address");
      window.setTimeout(() => {
        setBuyNowLoading(false);
      }, 1500);
    } catch (error) {
      setBuyNowLoading(false);
      toast({
        title: "Unable to continue",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
    }
  };

  const handleNotify = async () => {
    if (!notifyEmail.trim()) {
      toast({
        title: "Email required",
        description: "Enter your email to get a back-in-stock alert.",
        variant: "error",
      });
      return;
    }
    if (notifyLoading) return;
    setNotifyLoading(true);
    try {
      const res = await fetch("/api/stock/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, email: notifyEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "Unable to subscribe");
      }
      setNotifySent(true);
      trackEvent(
        "stock_notify_submitted",
        { productId: product.id, slug: product.slug },
        notifyEmail,
      );
      toast({
        title: "You're on the list",
        description: "We'll email you when this item is back in stock.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Unable to subscribe",
        description: error instanceof Error ? error.message : "Try again later.",
        variant: "error",
      });
    } finally {
      setNotifyLoading(false);
    }
  };

  const handlePriceDrop = async () => {
    if (!priceDropEmail.trim()) {
      toast({
        title: "Email required",
        description: "Enter your email to receive price drop alerts.",
        variant: "error",
      });
      return;
    }
    if (priceDropLoading) return;
    setPriceDropLoading(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "PRICE_DROP",
          productId: product.id,
          email: priceDropEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "Unable to subscribe");
      }
      setPriceDropSent(true);
      trackEvent(
        "price_drop_submitted",
        { productId: product.id, slug: product.slug },
        priceDropEmail,
      );
      toast({
        title: "Subscribed",
        description: "We'll notify you if this item goes on sale.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Unable to subscribe",
        description: error instanceof Error ? error.message : "Try again later.",
        variant: "error",
      });
    } finally {
      setPriceDropLoading(false);
    }
  };

  useEffect(() => {
    trackEvent("product_view", { productId: product.id, slug: product.slug, price, currency: product.currency });
  }, [product.id, product.slug, price, product.currency]);

  return (
    <div className="pb-28">
      <div className="space-y-3">
        {heroUrl && (
          <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-border bg-contrast">
            <Image
              src={heroUrl}
              alt={hero?.alt ?? displayTitle}
              fill
              priority
              sizes="100vw"
              className="object-cover"
              onClick={() => {
                setActiveIndex(selectedImageIndex);
                setLightboxOpen(true);
              }}
            />
          </div>
        )}

        <div className="columns-2 gap-3 md:columns-3">
          {gallery.map(({ img, index }) => {
            const imageUrl = resolveImageUrl(img.url);
            if (!imageUrl) return null;
            return (
            <button
              key={img.id}
              className="mb-3 block w-full overflow-hidden rounded-xl border border-border bg-contrast"
              onClick={() => {
                setSelectedImageIndex(index);
                setActiveIndex(index);
                setLightboxOpen(true);
              }}
            >
              <div className="relative aspect-[3/4]">
                <Image
                  src={imageUrl}
                  alt={img.alt ?? displayTitle}
                  fill
                  sizes="(min-width: 768px) 33vw, 50vw"
                  className="object-cover transition duration-500 hover:scale-[1.02]"
                  loading="lazy"
                />
              </div>
            </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="font-display text-2xl leading-tight">{displayTitle}</h1>
            <p className="text-sm text-muted">
              {availability} | {shippingProfile.carrier} {shippingProfile.eta}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">{formatAmount(price, product.currency).text}</p>
            <p className="text-xs text-muted">
              {shippingEstimate === 0
                ? "Free shipping"
                : `Est. shipping ${formatAmount(shippingEstimate, product.currency).text}`}
            </p>
            <p className="text-xs text-muted">Est. total {formatAmount(orderTotal, product.currency).text}</p>
            {profile.currency !== "USD" && product.currency.toUpperCase() === "USD" ? (
              <p className="text-[11px] text-muted">Local display only. Final checkout is billed in USD.</p>
            ) : null}
            {product.isNew && <Badge tone="accent" className="mt-2">New</Badge>}
          </div>
        </div>

        <p className="text-sm leading-7 text-muted">
          {product.descriptionEn || "Curated product details are being refined by our editorial team."}
        </p>

        {productHighlights.length > 0 && (
          <div className="rounded-xl border border-border bg-contrast px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Highlights</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
              {productHighlights.map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>
          </div>
        )}

        {detailItems.length > 0 && (
          <div className="rounded-xl border border-border bg-contrast px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Details</p>
            <div className="mt-3 grid gap-2 text-sm text-muted sm:grid-cols-2">
              {detailItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3">
                  <span className="text-ink">{item.label}</span>
                  <span>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {optionGroups.length > 0 && (
          <div className="rounded-xl border border-border bg-contrast px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Options</p>
            <div className="mt-3 space-y-3">
              {optionGroups.map((group) => (
                <div key={group.id} className="space-y-2">
                  <p className="text-sm font-medium text-ink">{group.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.values.map((value) => {
                      const active = selectedOptionsNormalized?.[group.id] === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          className={`rounded-full border px-3 py-1 text-xs transition ${
                            active
                              ? "border-ink bg-ink text-white"
                              : "border-border bg-surface text-ink hover:border-ink/60"
                          }`}
                          onClick={() => handleOptionSelect(group.id, value)}
                        >
                          <span className="inline-flex items-center gap-2">
                            {group.id === "color" ? (
                              <span
                                className="h-3 w-3 rounded-full border border-black/15"
                                style={{ background: resolveColorSwatch(value) }}
                                aria-hidden
                              />
                            ) : null}
                            <span>{value}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              Options are derived from imported variant data and listing content.
            </p>
          </div>
        )}

        {sizeGuideText ? (
          <div className="rounded-xl border border-border bg-contrast px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Size guide</p>
            <p className="mt-2 text-sm text-muted">{sizeGuideText}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-contrast px-4 py-3">
          {trustItems.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-sm text-muted">
              <item.icon size={16} className="text-ink" />
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-contrast px-4 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Payment methods</p>
          <div className="mt-3">
            <PaymentMethods variant="inline" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-contrast px-4 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Shipping & returns</p>
          <div className="mt-2 space-y-1 text-sm text-muted">
            <p>{shippingProfile.carrier} estimated {shippingProfile.eta}.</p>
            <p>{shippingProfile.note}</p>
            <p>7-day aftercare review window for delivery issues and wrong-item claims.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            className="rounded-full px-6"
            onClick={handleBuyNow}
            disabled={isOutOfStock || buyNowLoading}
            loading={buyNowLoading}
          >
            {isOutOfStock ? "Sold out" : "Buy now"}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="rounded-full px-6"
            onClick={handleAdd}
            disabled={isOutOfStock}
          >
            Add to bag
          </Button>
        </div>

        <PromoGiftNote />

        {isOutOfStock && (
          <div className="mt-2 rounded-xl border border-border bg-contrast px-4 py-3">
            <p className="text-sm font-medium">Currently out of stock</p>
            <p className="text-xs text-muted">
              Leave your email and we'll notify you as soon as it returns.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                placeholder="Email address"
                value={notifyEmail}
                onChange={(event) => setNotifyEmail(event.target.value)}
                className="w-full rounded-full border border-border bg-surface px-4 py-2 text-sm"
              />
              <Button
                size="sm"
                className="rounded-full"
                loading={notifyLoading}
                onClick={handleNotify}
                disabled={notifyLoading || notifySent}
              >
                {notifySent ? "Subscribed" : "Notify me"}
              </Button>
            </div>
          </div>
        )}

        <div className="mt-2 rounded-xl border border-border bg-contrast px-4 py-3">
          <p className="text-sm font-medium">Price drop notifications</p>
          <p className="text-xs text-muted">Get notified if this item's price changes.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              placeholder="Email address"
              value={priceDropEmail}
              onChange={(event) => setPriceDropEmail(event.target.value)}
              className="w-full rounded-full border border-border bg-surface px-4 py-2 text-sm"
            />
            <Button
              size="sm"
              className="rounded-full"
              loading={priceDropLoading}
              onClick={handlePriceDrop}
              disabled={priceDropLoading || priceDropSent}
            >
              {priceDropSent ? "Subscribed" : "Notify me"}
            </Button>
          </div>
        </div>

        <ConciergeCard
          context={{ productId: product.id, slug: product.slug, title: displayTitle }}
          compact
        />

        <AuthenticityPanel />
        <ReturnsTimeline />

        <section className="mt-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">Client feedback</h2>
            <span className="text-sm text-muted">
              {reviews.length} reviews{averageRating ? ` | ${averageRating.toFixed(1)}/5` : ""}
            </span>
          </div>
          {reviews.length === 0 ? (
            <p className="text-sm text-muted">
              No reviews yet. Verified customers can share feedback after delivery.
            </p>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <div key={review.id} className="rounded-xl border border-border bg-surface px-4 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{review.title ?? "Review"}</span>
                    <span className="text-muted">{review.rating} / 5</span>
                  </div>
                  {review.body && <p className="mt-2 text-sm text-muted">{review.body}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 border-t border-border bg-background/95 px-4 pb-4 pt-3 shadow-[0_-8px_30px_rgba(0,0,0,0.1)] md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Price</p>
            <p className="text-lg font-semibold">{formatAmount(price, product.currency).text}</p>
          </div>
          <Button
            fullWidth
            size="lg"
            className="rounded-full"
            onClick={handleBuyNow}
            disabled={isOutOfStock || buyNowLoading}
            loading={buyNowLoading}
          >
            {isOutOfStock ? "Sold out" : "Buy now"}
          </Button>
        </div>
      </div>

      <PdpLightbox
        open={lightboxOpen}
        images={images}
        index={activeIndex}
        onClose={() => setLightboxOpen(false)}
        onNavigate={setActiveIndex}
      />
    </div>
  );
}

type DetailItem = {
  label: string;
  value: string;
};

function buildDetailItems(product: ProductWithRelations): DetailItem[] {
  const text = `${product.titleEn} ${product.descriptionEn ?? ""}`.toLowerCase();
  const tags = product.tags.map((tag) => tag.toLowerCase());
  const details: DetailItem[] = [];

  const materialCandidates = [
    ...extractMaterialsFromTags(product.tags),
    ...extractMaterialOptionsFromText(`${product.titleEn} ${product.descriptionEn ?? ""}`),
  ];
  const material = materialCandidates[0] ?? matchToken(text, tags, [
    { label: "Leather", re: /\bleather\b/ },
    { label: "Canvas", re: /\bcanvas\b/ },
    { label: "Denim", re: /\bdenim\b/ },
    { label: "Suede", re: /\bsuede\b/ },
    { label: "Wool", re: /\bwool\b/ },
    { label: "Silk", re: /\bsilk\b/ },
  ]);
  if (material) details.push({ label: "Material", value: material });

  const colors = resolveColorOptions(product);
  if (colors.length === 1) {
    details.push({ label: "Color", value: colors[0] });
  } else if (colors.length > 1) {
    details.push({ label: "Available colors", value: colors.join(", ") });
  }

  const sizes = resolveSizeOptions(product, text);
  if (sizes.length === 1) {
    details.push({ label: "Size", value: sizes[0] });
  } else if (sizes.length > 1) {
    details.push({ label: "Available sizes", value: sizes.join(", ") });
  } else {
    const size = matchSize(text, tags);
    if (size) details.push({ label: "Size", value: size });
  }

  const condition = matchToken(text, tags, [
    { label: "New", re: /\bnew\b/ },
    { label: "Vintage", re: /\bvintage\b/ },
    { label: "Pre-owned", re: /\bpre[-\s]?owned\b|\bpreowned\b/ },
  ]);
  if (condition) details.push({ label: "Condition", value: condition });

  const includes = matchIncludes(text);
  if (includes) details.push({ label: "Includes", value: includes });

  return details.slice(0, 4);
}

function matchToken(text: string, tags: string[], tokens: Array<{ label: string; re: RegExp }>) {
  for (const token of tokens) {
    if (token.re.test(text) || tags.includes(token.label.toLowerCase())) {
      return token.label;
    }
  }
  return null;
}

function matchSize(text: string, tags: string[]) {
  const sizeTokens = [
    { label: "Mini", re: /\bmini\b/ },
    { label: "Nano", re: /\bnano\b/ },
    { label: "Small", re: /\bsmall\b/ },
    { label: "Medium", re: /\bmedium\b/ },
    { label: "Large", re: /\blarge\b/ },
  ];
  for (const token of sizeTokens) {
    if (token.re.test(text) || tags.includes(token.label.toLowerCase())) {
      return token.label;
    }
  }
  const measurement = text.match(/\b(\d{2,3})\s?(cm|mm)\b/);
  if (measurement) return `${measurement[1]}${measurement[2]}`;
  return null;
}

function matchIncludes(text: string) {
  const items: string[] = [];
  if (/\bdust bag\b/.test(text)) items.push("Dust bag");
  if (/\bbox\b/.test(text)) items.push("Box");
  if (/\bcard\b|\bauthentication card\b/.test(text)) items.push("Card");
  if (/\breceipt\b/.test(text)) items.push("Receipt");
  if (!items.length) return null;
  return items.slice(0, 2).join(", ");
}

type OptionGroup = {
  id: "color" | "size";
  label: string;
  summaryLabel: string;
  values: string[];
};

const COLOR_VALUE_MAP: Record<string, string> = {
  black: "Black",
  white: "White",
  beige: "Beige",
  cream: "Cream",
  brown: "Brown",
  tan: "Tan",
  camel: "Camel",
  gray: "Gray",
  grey: "Gray",
  red: "Red",
  pink: "Pink",
  blue: "Blue",
  navy: "Navy",
  green: "Green",
  olive: "Olive",
  yellow: "Yellow",
  orange: "Orange",
  purple: "Purple",
  gold: "Gold",
  silver: "Silver",
  multicolor: "Multicolor",
  multicolour: "Multicolor",
  "黑": "Black",
  "黑色": "Black",
  "白": "White",
  "白色": "White",
  "米白": "Cream",
  "米色": "Beige",
  "棕": "Brown",
  "棕色": "Brown",
  "咖啡": "Brown",
  "咖啡色": "Brown",
  "灰": "Gray",
  "灰色": "Gray",
  "红": "Red",
  "红色": "Red",
  "酒红": "Red",
  "粉": "Pink",
  "粉色": "Pink",
  "蓝": "Blue",
  "蓝色": "Blue",
  "藏蓝": "Navy",
  "深蓝": "Navy",
  "绿": "Green",
  "绿色": "Green",
  "橄榄绿": "Olive",
  "黄": "Yellow",
  "黄色": "Yellow",
  "橙": "Orange",
  "橙色": "Orange",
  "紫": "Purple",
  "紫色": "Purple",
  "金": "Gold",
  "金色": "Gold",
  "银": "Silver",
  "银色": "Silver",
  "多色": "Multicolor",
};

const COLOR_RULES: Array<{ label: string; re: RegExp }> = [
  { label: "Black", re: /\b(black|jet|onyx)\b|黑色?/ },
  { label: "White", re: /\b(white|ivory|cream)\b|白色?|米白/ },
  { label: "Beige", re: /\b(beige|taupe|sand)\b|米色|沙色/ },
  { label: "Brown", re: /\b(brown|tan|camel|chocolate|cognac)\b|棕色?|咖啡色?|驼色/ },
  { label: "Gray", re: /\b(gray|grey|charcoal)\b|灰色?/ },
  { label: "Red", re: /\b(red|burgundy|maroon|wine)\b|红色?|酒红/ },
  { label: "Pink", re: /\b(pink|blush|rose)\b|粉色?/ },
  { label: "Blue", re: /\b(blue|cobalt|sky|denim)\b|蓝色?/ },
  { label: "Navy", re: /\b(navy|midnight\s*blue)\b|藏蓝|深蓝/ },
  { label: "Green", re: /\b(green|olive|emerald|khaki)\b|绿色?|墨绿|军绿|橄榄绿/ },
  { label: "Yellow", re: /\b(yellow|mustard)\b|黄色?/ },
  { label: "Orange", re: /\b(orange|rust)\b|橙色?|橘色?/ },
  { label: "Purple", re: /\b(purple|lavender|lilac)\b|紫色?/ },
  { label: "Gold", re: /\b(gold|champagne)\b|金色?/ },
  { label: "Silver", re: /\b(silver)\b|银色?/ },
  { label: "Multicolor", re: /\b(multi[-\s]?color|multicolor|rainbow)\b|多色|拼色/ },
];

const SHOE_KEYWORDS = /\b(shoe|shoes|sneaker|sneakers|boot|boots|loafer|loafers|heel|heels|sandal|sandals|trainer|trainers)\b/;
const RING_KEYWORDS = /\b(ring|band)\b/;
const SHOE_SIZES = ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45"];
const RING_SIZES = ["5", "6", "7", "8", "9"];

function normalizeColorLabel(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  const lowered = raw.toLowerCase();
  const compact = lowered.replace(/[\s_-]+/g, "");
  const mapped = COLOR_VALUE_MAP[lowered] ?? COLOR_VALUE_MAP[compact];
  if (mapped) return mapped;

  return raw
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

function dedupeColors(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const label = normalizeColorLabel(value);
    if (!label) continue;
    const key = label.toLowerCase().replace(/[\s_-]+/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  return result;
}

function extractColorsFromTags(tags: string[]) {
  return extractColorsFromOptionTags(tags);
}

function resolveColorOptions(product: ProductWithRelations) {
  const explicit = extractColorsFromTags(product.tags);
  if (explicit.length > 0) {
    return explicit;
  }
  const searchText = buildOptionSearchText(product);
  return extractColorOptionsFromText(searchText);
}

function resolveSizeOptions(product: ProductWithRelations, searchText?: string) {
  const explicit = extractSizesFromOptionTags(product.tags);
  if (explicit.length > 0) {
    return explicit;
  }
  const text = searchText ?? buildOptionSearchText(product);
  return extractSizeOptionsFromText(text);
}

function buildOptionGroups(product: ProductWithRelations): OptionGroup[] {
  const searchText = buildOptionSearchText(product);
  const colors = resolveColorOptions(product);
  const sizes = resolveSizeOptions(product, searchText);
  const groups: OptionGroup[] = [];

  if (colors.length) {
    groups.push({ id: "color", label: "Color", summaryLabel: "Color", values: colors });
  }

  if (sizes.length > 0) {
    groups.push({
      id: "size",
      label: "Size",
      summaryLabel: "Size",
      values: sizes,
    });
  } else {
    const productType = detectProductType(searchText);
    if (productType === "shoe") {
      groups.push({
        id: "size",
        label: "Shoe size (EU)",
        summaryLabel: "Size",
        values: SHOE_SIZES,
      });
    } else if (productType === "ring") {
      groups.push({
        id: "size",
        label: "Ring size",
        summaryLabel: "Size",
        values: RING_SIZES,
      });
    }
  }

  return groups;
}

function normalizeSelectedOptions(
  groups: OptionGroup[],
  selected: Record<string, string>,
): Record<string, string> | undefined {
  if (!groups.length) return undefined;
  const normalized: Record<string, string> = {};
  for (const group of groups) {
    const value = selected[group.id];
    if (value && group.values.includes(value)) {
      normalized[group.id] = value;
    }
  }
  return Object.keys(normalized).length ? normalized : undefined;
}

function buildOptionSummary(
  groups: OptionGroup[],
  selected?: Record<string, string>,
): string {
  if (!selected) return "";
  const parts = groups
    .map((group) => {
      const value = selected[group.id];
      return value ? `${group.summaryLabel}: ${value}` : null;
    })
    .filter(Boolean) as string[];
  return parts.join(" | ");
}

function buildOptionSearchText(product: ProductWithRelations) {
  const parts = [
    product.titleEn,
    product.descriptionEn ?? "",
    ...product.tags,
    ...product.images.map((img) => img.alt ?? ""),
    ...product.images.map((img) => img.url ?? ""),
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function extractColors(text: string) {
  const detected: string[] = [];
  for (const rule of COLOR_RULES) {
    if (rule.re.test(text)) {
      detected.push(rule.label);
    }
  }
  return dedupeColors(detected);
}

function detectProductType(text: string): "shoe" | "ring" | null {
  if (SHOE_KEYWORDS.test(text)) return "shoe";
  if (RING_KEYWORDS.test(text)) return "ring";
  return null;
}

function buildStandardizedTitle(product: ProductWithRelations, details: DetailItem[]) {
  const rawTitle = product.titleEn.trim();
  if (rawTitle.length >= 20 && /\s/.test(rawTitle)) return rawTitle;

  const category = product.category?.nameEn ?? "Curated Item";
  const material = details.find((item) => item.label === "Material")?.value;
  const size = details.find((item) => item.label.includes("Size"))?.value;
  const parts = [category, material, size].filter(Boolean);
  if (!parts.length) return rawTitle || "Luxury curated piece";
  return parts.join(" · ");
}

function buildProductHighlights(product: ProductWithRelations, details: DetailItem[]) {
  const highlights: string[] = [];
  const description = (product.descriptionEn ?? "")
    .split(/[\n。.!?]+/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const sentence of description) {
    if (sentence.length < 28) continue;
    highlights.push(sentence);
    if (highlights.length >= 3) break;
  }

  for (const detail of details) {
    if (highlights.length >= 4) break;
    highlights.push(`${detail.label}: ${detail.value}`);
  }

  return Array.from(new Set(highlights)).slice(0, 4);
}

function buildSizeGuide(groups: OptionGroup[], product: ProductWithRelations) {
  const text = buildOptionSearchText(product);
  const sizeGroup = groups.find((group) => group.id === "size");
  if (!sizeGroup || !sizeGroup.values.length) return "";

  if (sizeGroup.values.some((value) => /(swatch|meter|metre|roll)/i.test(value))) {
    return "Fabric sizes are listed by swatch, meter, or roll. Confirm required yield before checkout if you are matching a production run.";
  }

  if (SHOE_KEYWORDS.test(text)) {
    return "Footwear uses EU sizing. If you wear half sizes, choose one size up for a more comfortable fit.";
  }

  if (sizeGroup.values.some((value) => /^EU\s/i.test(value) || /^US\s/i.test(value))) {
    return "Variant options include regional numeric sizing. Compare with your usual brand size before checkout.";
  }

  if (sizeGroup.values.some((value) => /(mini|small|medium|large|nano)/i.test(value))) {
    return "Bag size labels follow brand naming (Mini/Small/Medium/Large). Check product details for fit preference.";
  }

  if (sizeGroup.values.includes("One Size")) {
    return "This item is offered in one size. Strap/drop and dimensions are provided in details when available.";
  }

  return "";
}

const COLOR_SWATCH_MAP: Record<string, string> = {
  black: "#111111",
  white: "#f8f8f8",
  beige: "#d8c3a5",
  cream: "#f0e9dc",
  brown: "#7b4f2c",
  tan: "#a47148",
  camel: "#c19a6b",
  gray: "#8a8a8a",
  red: "#b91c1c",
  pink: "#ec4899",
  blue: "#2563eb",
  navy: "#1e3a8a",
  green: "#15803d",
  olive: "#4d5d2c",
  yellow: "#ca8a04",
  orange: "#ea580c",
  purple: "#7e22ce",
  gold: "#c9a227",
  silver: "#a8a29e",
  multicolor: "linear-gradient(135deg,#f43f5e,#f59e0b,#22c55e,#3b82f6,#a855f7)",
};

function resolveColorSwatch(color: string) {
  const key = color.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (COLOR_SWATCH_MAP[key]) return COLOR_SWATCH_MAP[key];
  return "#d4d4d4";
}

const COLOR_IMAGE_KEYWORDS: Record<string, string[]> = {
  black: ["black", "onyx", "jet", "黑"],
  white: ["white", "ivory", "奶白", "白"],
  beige: ["beige", "sand", "米色"],
  brown: ["brown", "tan", "camel", "cognac", "棕", "咖啡"],
  gray: ["gray", "grey", "charcoal", "灰"],
  red: ["red", "burgundy", "wine", "红"],
  pink: ["pink", "rose", "blush", "粉"],
  blue: ["blue", "cobalt", "denim", "蓝"],
  navy: ["navy", "midnight", "藏蓝", "深蓝"],
  green: ["green", "olive", "emerald", "军绿", "绿"],
  yellow: ["yellow", "mustard", "黄"],
  orange: ["orange", "rust", "橙"],
  purple: ["purple", "lavender", "紫"],
  gold: ["gold", "champagne", "金"],
  silver: ["silver", "银"],
  multicolor: ["multi", "rainbow", "拼色", "多色"],
};

function buildColorImageIndexMap(product: ProductWithRelations) {
  const map = new Map<string, number>();
  product.images.forEach((image, index) => {
    const haystack = [image.alt ?? "", image.label ?? "", image.url].join(" ").toLowerCase();
    Object.entries(COLOR_IMAGE_KEYWORDS).forEach(([color, keywords]) => {
      if (map.has(color)) return;
      if (keywords.some((keyword) => haystack.includes(keyword))) {
        map.set(color, index);
      }
    });
  });
  return map;
}
