"use client";

import Image from "next/image";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useBagStore } from "@/lib/state/bag-store";
import { useDisplayPricing } from "@/lib/hooks/use-display-pricing";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics/client";
import { ConciergeCard } from "@/components/concierge/concierge-card";
import { calculateShipping } from "@/lib/utils/shipping";
import { resolveImageUrl } from "@/lib/utils/image";
import { useCheckoutStore, type Address } from "@/lib/state/checkout-store";
import { useToast } from "@/lib/hooks/useToast";
import { AddressFormTest } from "@/components/checkout/address-form-test";
import { PromoGiftNote } from "@/components/promo/promo-gift-note";
import { getShippingDisplayProfile } from "@/lib/utils/display-content";

export function BagClient() {
  const router = useRouter();
  const items = useBagStore((s) => s.items);
  const updateQuantity = useBagStore((s) => s.updateQuantity);
  const removeItem = useBagStore((s) => s.removeItem);
  const checkoutAddress = useCheckoutStore((s) => s.address);
  const setCheckoutAddress = useCheckoutStore((s) => s.setAddress);
  const { toast } = useToast();
  const { profile, formatAmount } = useDisplayPricing();
  const shippingProfile = useMemo(() => getShippingDisplayProfile(profile.countryCode), [profile.countryCode]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [testCheckoutOpen, setTestCheckoutOpen] = useState(false);
  const checkoutTestMode =
    process.env.NEXT_PUBLIC_CHECKOUT_TEST_MODE === "1" &&
    process.env.NEXT_PUBLIC_CHECKOUT_TEST_MODAL === "1";

  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  const summary = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shippingEstimate = calculateShipping(subtotal);
    const total = subtotal + shippingEstimate;
    return { subtotal, shippingEstimate, total };
  }, [items]);

  useEffect(() => {
    if (items.length > 0) {
      trackEvent("bag_view", { items: items.length, total: summary.total });
    }
  }, [items.length, summary.total]);

  const handleCheckout = async (overrideAddress?: Address | null) => {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    try {
      if (items.length === 0) {
        throw new Error("Bag is empty");
      }

      trackEvent("checkout_started", { items: items.length, total: summary.total, source: "bag" });

      const resolvedAddress = overrideAddress ?? checkoutAddress;
      if (resolvedAddress) {
        setCheckoutAddress(resolvedAddress);
      }

      router.push("/checkout/address");
      return true;
    } catch (error) {
      toast({
        title: "Unable to start checkout",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
      return false;
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Bag</p>
          <h1 className="font-display text-2xl">Your bag is empty</h1>
          <p className="text-sm text-muted">
            Curate with confidence. Add pieces you love and check out when ready.
          </p>
        </div>
        <Button asChild><Link href="/">Back to home</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 md:flex-row">
      <div className="flex-1 space-y-4">
        {items.map((item) => {
          const imageUrl = resolveImageUrl(item.image);
          return (
            <div
              key={item.lineId}
              className="flex gap-4 rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)]"
            >
              <div className="relative h-28 w-24 overflow-hidden rounded-lg border border-border bg-contrast">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={item.title}
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted">
                    Image coming soon
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <h2 className="font-medium">{item.title}</h2>
                    {item.badge && (
                      <span className="text-xs uppercase tracking-[0.18em] text-muted">
                        {item.badge}
                      </span>
                    )}
                    <p className="text-xs text-muted">Inspected & ready to ship | UPS 5-9 days</p>
                  </div>
                  <button
                    type="button"
                    className="text-muted transition hover:text-ink"
                    onClick={() => {
                      removeItem(item.lineId);
                      trackEvent("bag_item_removed", {
                        productId: item.productId,
                        lineId: item.lineId,
                        options: item.options ?? null,
                      });
                    }}
                    aria-label="Remove item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <QuantityStepper
                    value={item.quantity}
                    min={1}
                    max={9}
                    onChange={(val) => {
                      updateQuantity(item.lineId, val);
                      trackEvent("bag_quantity_changed", {
                        productId: item.productId,
                        lineId: item.lineId,
                        qty: val,
                        options: item.options ?? null,
                      });
                    }}
                  />
                  <p className="text-base font-semibold">
                    {formatAmount(item.price * item.quantity, item.currency).text}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="w-full space-y-4 md:w-[320px]">
        <div className="space-y-4 rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Subtotal</span>
            <span className="font-medium">{formatAmount(summary.subtotal).text}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Shipping ({shippingProfile.carrier} {shippingProfile.eta})</span>
            <span className="font-medium">{formatAmount(summary.shippingEstimate).text}</span>
          </div>
          <div className="flex items-center justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatAmount(summary.total).text}</span>
          </div>
          {profile.currency !== "USD" ? (
            <p className="text-xs text-muted">
              Display language: {profile.languageLabel} · Display currency: {profile.currency}. Final checkout is billed in USD.
            </p>
          ) : null}
          <PromoGiftNote />
          <Button
            className="w-full rounded-full"
            size="lg"
            onClick={() => {
              if (checkoutTestMode) {
                setTestCheckoutOpen(true);
              } else {
                void handleCheckout();
              }
            }}
            loading={checkoutLoading}
          >
            Secure checkout
          </Button>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <Link href="/policies" className="underline underline-offset-4">
              Shipping
            </Link>
            <span>|</span>
            <Link href="/policies" className="underline underline-offset-4">
              Returns
            </Link>
            <span>|</span>
            <span>Secure hosted checkout | {shippingProfile.carrier} {shippingProfile.eta}</span>
          </div>
        </div>
        <ConciergeCard context={{ source: "bag" }} compact />
      </div>

      {checkoutTestMode && testCheckoutOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 py-6 md:items-center">
          <div className="w-full max-w-5xl space-y-4 rounded-3xl border border-border bg-surface p-6 shadow-[var(--shadow-soft)] md:rounded-2xl md:p-8 max-h-[88vh] overflow-y-auto">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Secure checkout</p>
              <h3 className="font-display text-2xl">Delivery details</h3>
              <p className="text-sm text-muted">
                Confirm the recipient details to generate your secure payment link.
              </p>
            </div>
            <AddressFormTest
              initial={null}
              submitLabel="Confirm & get payment link"
              loading={checkoutLoading}
              onSubmit={async (address) => {
                setCheckoutAddress(address);
                const ok = await handleCheckout(address);
                if (ok) {
                  setTestCheckoutOpen(false);
                }
              }}
              onCancel={() => setTestCheckoutOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
