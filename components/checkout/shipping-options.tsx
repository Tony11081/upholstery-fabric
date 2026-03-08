"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useBagStore } from "@/lib/state/bag-store";
import { useCheckoutStore, type ShippingMethod } from "@/lib/state/checkout-store";
import { trackEvent } from "@/lib/analytics/client";
import { calculateShipping } from "@/lib/utils/shipping";
import { formatPrice } from "@/lib/utils/format";

export function ShippingOptions() {
  const router = useRouter();
  const items = useBagStore((s) => s.items);
  const saved = useCheckoutStore((s) => s.shipping);
  const setShipping = useCheckoutStore((s) => s.setShipping);
  const address = useCheckoutStore((s) => s.address);
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  );
  const shippingPrice = calculateShipping(subtotal);
  const methods = useMemo<ShippingMethod[]>(
    () => [
      {
        id: "standard",
        label: shippingPrice === 0 ? "Complimentary UPS shipping" : "UPS worldwide shipping",
        eta: "5-9 business days (UPS)",
        price: shippingPrice,
      },
    ],
    [shippingPrice],
  );
  const initialMethod = useMemo(() => {
    if (!saved) return methods[0];
    return methods.find((method) => method.id === saved.id) ?? methods[0];
  }, [methods, saved]);
  const [selected, setSelected] = useState<ShippingMethod | null>(initialMethod);

  useEffect(() => {
    if (!address) {
      router.push("/checkout/address");
    }
  }, [address, router]);
  useEffect(() => {
    setSelected(initialMethod);
  }, [initialMethod]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selected) {
      setShipping(selected);
      trackEvent(
        "shipping_selected",
        { id: selected.id, price: selected.price },
        address?.email,
      );
      router.push("/checkout/payment");
    }
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      {methods.map((method) => {
        const active = selected?.id === method.id;
        return (
          <label
            key={method.id}
            className={`flex cursor-pointer items-center justify-between rounded-xl border bg-surface px-4 py-3 transition ${
              active ? "border-ink" : "border-border hover:border-ink/70"
            }`}
          >
            <div className="space-y-1">
              <p className="font-medium">{method.label}</p>
              <p className="text-xs text-muted">{method.eta}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">
                {method.price === 0 ? "Free" : formatPrice(method.price)}
              </span>
              <input
                type="radio"
                name="shipping"
                className="h-4 w-4 accent-ink"
                checked={active}
                onChange={() => setSelected(method)}
              />
            </div>
          </label>
        );
      })}
      <Button type="submit" size="lg" className="rounded-full">
        Continue to secure checkout
      </Button>
    </form>
  );
}
