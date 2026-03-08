"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBagStore } from "@/lib/state/bag-store";
import { useCheckoutStore } from "@/lib/state/checkout-store";

export function TestCheckoutBootstrap() {
  const router = useRouter();
  const addItem = useBagStore((s) => s.addItem);
  const setAddress = useCheckoutStore((s) => s.setAddress);
  const setShipping = useCheckoutStore((s) => s.setShipping);

  useEffect(() => {
    addItem({
      productId: "test-1",
      title: "Test Product",
      price: 0.1,
      currency: "USD",
      quantity: 1,
      image: "https://via.placeholder.com/150",
      slug: "test-product",
    });

    setAddress({
      fullName: "Test User",
      email: "test@example.com",
      phone: "1234567890",
      country: "US",
      address1: "123 Test St",
      address2: "",
      city: "Test City",
      state: "TS",
      postalCode: "12345",
    });

    setShipping({
      id: "standard",
      label: "Standard",
      eta: "5-7",
      price: 0,
    });

    const timeout = window.setTimeout(() => {
      router.push("/checkout/payment-test");
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [addItem, setAddress, setShipping, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p>Setting up test checkout...</p>
    </div>
  );
}
