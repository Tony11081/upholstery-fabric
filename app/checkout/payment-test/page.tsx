import { notFound } from "next/navigation";
import { CheckoutSummary } from "@/components/checkout/checkout-summary";
import { PaymentStep } from "@/components/checkout/payment-step";
import { TestOrderSeeder } from "@/components/checkout/test-order-seeder";
import { isProd } from "@/lib/utils/env";

export const metadata = {
  title: "Checkout - Test",
  robots: { index: false, follow: false },
};

export default function CheckoutPaymentTestPage() {
  if (isProd) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-4 sm:px-6 md:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 md:flex-row">
        <div className="flex-1 space-y-4">
          <h1 className="font-display text-2xl">Test checkout</h1>
          <TestOrderSeeder />
          <PaymentStep channelLabel="Test channel" />
        </div>
        <div className="w-full md:w-[320px]">
          <CheckoutSummary />
        </div>
      </div>
    </main>
  );
}
