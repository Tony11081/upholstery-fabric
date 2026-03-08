import { ShieldCheck, Truck, PhoneCall } from "lucide-react";
import { AddressForm } from "@/components/checkout/address-form";
import { CheckoutSummary } from "@/components/checkout/checkout-summary";
import { CheckoutSteps } from "@/components/checkout/checkout-steps";

export const metadata = {
  title: "Checkout - Address",
  robots: { index: false, follow: false },
};

export default function CheckoutAddressPage() {
  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-4 sm:px-6 md:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 md:flex-row">
        <div className="flex-1 space-y-4">
          <div className="space-y-3">
            <CheckoutSteps current="address" />
            <div className="space-y-1">
              <h1 className="font-display text-2xl">Delivery address</h1>
              <p className="text-sm text-muted">
                Enter delivery details to generate your secure checkout link.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted">
              <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1">
                <ShieldCheck size={12} className="text-ink" />
                Secure hosted checkout
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1">
                <Truck size={12} className="text-ink" />
                Global UPS 5-9 days
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1">
                <PhoneCall size={12} className="text-ink" />
                Concierge support
              </span>
            </div>
          </div>
          <AddressForm />
        </div>
        <div className="w-full md:w-[320px]">
          <CheckoutSummary sticky variant="address" />
        </div>
      </div>
    </main>
  );
}
