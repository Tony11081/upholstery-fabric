"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useBagStore } from "@/lib/state/bag-store";
import { useCheckoutStore, type Address, type ShippingMethod } from "@/lib/state/checkout-store";
import { calculateShipping } from "@/lib/utils/shipping";
import { formatPrice } from "@/lib/utils/format";

type ProductApiItem = {
  id: string;
  slug: string;
  titleEn: string;
  price: number;
  currency: string;
  images?: Array<{ url?: string | null; isCover?: boolean | null }>;
};

type TestProfile = {
  id: string;
  label: string;
  address: Omit<Address, "phone" | "email"> & { email: string; phone: string };
};

const TEST_PROFILES: TestProfile[] = [
  {
    id: "us",
    label: "United States (+1)",
    address: {
      fullName: "Test User",
      email: "test+us@uootd.com",
      phone: "+1 2025550123",
      country: "United States",
      address1: "123 Test St",
      address2: "",
      city: "New York",
      state: "NY",
      postalCode: "10001",
    },
  },
  {
    id: "cn",
    label: "China (+86)",
    address: {
      fullName: "Test User",
      email: "test+cn@uootd.com",
      phone: "+86 13800138000",
      country: "China",
      address1: "1 Test Rd",
      address2: "",
      city: "Shanghai",
      state: "Shanghai",
      postalCode: "200000",
    },
  },
  {
    id: "fr",
    label: "France (+33)",
    address: {
      fullName: "Test User",
      email: "test+fr@uootd.com",
      phone: "+33 612345678",
      country: "France",
      address1: "10 Rue Test",
      address2: "",
      city: "Paris",
      state: "Ile-de-France",
      postalCode: "75001",
    },
  },
  {
    id: "uk",
    label: "United Kingdom (+44)",
    address: {
      fullName: "Test User",
      email: "test+uk@uootd.com",
      phone: "+44 7400123456",
      country: "United Kingdom",
      address1: "5 Test Lane",
      address2: "",
      city: "London",
      state: "London",
      postalCode: "SW1A 1AA",
    },
  },
];

async function fetchTestProduct(): Promise<ProductApiItem | null> {
  const response = await fetch("/api/products?limit=1&sort=popular&availability=in_stock");
  if (!response.ok) return null;
  const data = (await response.json().catch(() => null)) as { products?: ProductApiItem[] } | null;
  return data?.products?.[0] ?? null;
}

export function TestOrderSeeder() {
  const addItem = useBagStore((s) => s.addItem);
  const clearBag = useBagStore((s) => s.clear);
  const setAddress = useCheckoutStore((s) => s.setAddress);
  const setShipping = useCheckoutStore((s) => s.setShipping);
  const [profileId, setProfileId] = useState(TEST_PROFILES[0]?.id ?? "us");
  const [phone, setPhone] = useState(TEST_PROFILES[0]?.address.phone ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const profile = useMemo(
    () => TEST_PROFILES.find((item) => item.id === profileId) ?? TEST_PROFILES[0],
    [profileId],
  );

  useEffect(() => {
    if (profile?.address.phone) {
      setPhone(profile.address.phone);
    }
  }, [profile]);

  const handleSeed = async () => {
    if (!profile) return;
    setLoading(true);
    setStatus(null);
    try {
      const product = await fetchTestProduct();
      const price = Number(product?.price ?? 99);
      const currency = product?.currency ?? "USD";
      const image =
        product?.images?.find((img) => img?.isCover)?.url ??
        product?.images?.[0]?.url ??
        undefined;

      clearBag();
      addItem({
        productId: product?.id ?? `test-product-${Date.now()}`,
        slug: product?.slug,
        title: product?.titleEn ?? "Test item",
        price,
        currency,
        quantity: 1,
        image,
      });

      const address: Address = {
        ...profile.address,
        phone: phone.trim() || profile.address.phone,
      };
      setAddress(address);

      const subtotal = price;
      const shippingPrice = calculateShipping(subtotal);
      const shipping: ShippingMethod = {
        id: "standard",
        label: shippingPrice === 0 ? "Complimentary shipping" : "Standard tracked shipping",
        eta: "3-5 business days (tracked)",
        price: shippingPrice,
      };
      setShipping(shipping);
      setStatus(
        `Loaded 1 item (${formatPrice(price)}) and set ${shipping.label}.`,
      );
    } catch (error) {
      setStatus("Failed to seed test order. Please try again.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-4 text-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Test order seeder</p>
          <p className="text-xs text-muted">Use a real country phone format (E.164).</p>
        </div>
      </div>
      <div className="space-y-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Country preset
          <select
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink"
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
          >
            {TEST_PROFILES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Phone
          <input
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 2025550123"
          />
        </label>
        <Button size="sm" className="w-full rounded-full" onClick={handleSeed} loading={loading}>
          Generate test order
        </Button>
        {status ? <p className="text-xs text-muted">{status}</p> : null}
      </div>
    </div>
  );
}
