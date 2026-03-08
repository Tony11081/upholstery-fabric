"use client";
import Link from "next/link";
import { useMemo } from "react";
import { Lock, MessageCircle, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { useDisplayPricing } from "@/lib/hooks/use-display-pricing";
import { useBagStore } from "@/lib/state/bag-store";
import { Button } from "@/components/ui/button";
import { calculateShipping } from "@/lib/utils/shipping";
import { PromoGiftNote } from "@/components/promo/promo-gift-note";
import { PaymentMethods } from "@/components/ui/payment-methods";
import { getShippingDisplayProfile } from "@/lib/utils/display-content";

type SummaryProps = {
  ctaLabel?: string;
  onCheckout?: () => void;
  sticky?: boolean;
  variant?: "default" | "address";
};

export function CheckoutSummary({
  ctaLabel = "Continue to secure checkout",
  onCheckout,
  sticky,
  variant = "default",
}: SummaryProps) {
  const items = useBagStore((s) => s.items);
  const { profile, formatAmount } = useDisplayPricing();
  const shippingProfile = useMemo(() => getShippingDisplayProfile(profile.countryCode), [profile.countryCode]);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingCost = calculateShipping(subtotal);
  const total = subtotal + shippingCost;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const showAddressDetails = variant === "address";
  const whatsapp = process.env.NEXT_PUBLIC_CONCIERGE_WHATSAPP ?? "";
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? process.env.NEXT_PUBLIC_CONCIERGE_EMAIL ?? "";
  const whatsappLink = useMemo(() => {
    if (!whatsapp) return "";
    const digits = whatsapp.replace(/[^\d+]/g, "");
    return `https://wa.me/${digits.replace(/^\+/, "")}`;
  }, [whatsapp]);

  return (
    <div
      className={`space-y-4 rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)] ${
        sticky ? "md:sticky md:top-6" : ""
      }`}
    >
      {showAddressDetails && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted">
            <span>Order summary ({itemCount})</span>
            <Link href="/bag" className="text-[11px] font-medium text-ink underline underline-offset-4">
              Edit bag
            </Link>
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-muted">Your bag is empty.</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.lineId} className="flex items-start justify-between gap-3 text-sm">
                  <div className="space-y-1">
                    <p className="font-medium text-ink">{item.title}</p>
                    {item.badge ? (
                      <p className="text-xs text-muted">{item.badge}</p>
                    ) : null}
                    <p className="text-xs text-muted">Qty {item.quantity}</p>
                  </div>
                  <span className="font-medium">
                    {formatAmount(item.price * item.quantity, item.currency).text}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="h-px bg-border" />
        </div>
      )}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">Subtotal</span>
        <span className="font-medium">{formatAmount(subtotal).text}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">Shipping ({shippingProfile.carrier} {shippingProfile.eta})</span>
        <span className="font-medium">{formatAmount(shippingCost).text}</span>
      </div>
      <div className="flex items-center justify-between text-base font-semibold">
        <span>Total</span>
        <span>{formatAmount(total).text}</span>
      </div>
      {profile.currency !== "USD" ? (
        <p className="text-xs text-muted">
          Display language: {profile.languageLabel} · Display currency: {profile.currency}. Final checkout is billed in USD.
        </p>
      ) : null}
      <PromoGiftNote />
      {showAddressDetails && (
        <div className="space-y-3 rounded-xl border border-border bg-contrast p-3 text-xs text-muted">
          <div className="flex items-start gap-2">
            <ShieldCheck size={14} className="mt-0.5 text-ink" />
            <span>Secure hosted checkout. Your payment details are processed on the secure payment page.</span>
          </div>
          <div className="flex items-start gap-2">
            <Truck size={14} className="mt-0.5 text-ink" />
            <span>
              {shippingProfile.carrier} delivery ({shippingProfile.eta}). Updates sent to your email and phone.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <RotateCcw size={14} className="mt-0.5 text-ink" />
            <span>Returns support is available if anything is not as expected.</span>
          </div>
          <div className="flex items-start gap-2">
            <Lock size={14} className="mt-0.5 text-ink" />
            <span>We only use your details for delivery updates and payment confirmation.</span>
          </div>
        </div>
      )}
      {showAddressDetails && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Payment methods</p>
          <PaymentMethods variant="inline" />
        </div>
      )}
      {onCheckout && (
        <Button className="w-full rounded-full" size="lg" onClick={onCheckout}>
          {ctaLabel}
        </Button>
      )}
      {showAddressDetails && (whatsappLink || supportEmail) && (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-3 text-xs">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Need help?</p>
          <div className="flex flex-wrap gap-2">
            {whatsappLink ? (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-ink"
              >
                <MessageCircle size={12} />
                WhatsApp support
              </a>
            ) : null}
            {supportEmail ? (
              <a
                href={`mailto:${supportEmail}`}
                className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-ink"
              >
                Email support
              </a>
            ) : null}
          </div>
          <p className="text-xs text-muted">Our concierge can assist with sizing, quality, and delivery.</p>
        </div>
      )}
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
  );
}
