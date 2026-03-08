import { Suspense } from "react";
import { AwaitingPaymentClient } from "@/components/order/awaiting-payment-client";

export const metadata = {
  title: "Checkout details",
  robots: { index: false, follow: false },
};

export default function AwaitingPaymentPage({
  searchParams,
}: {
  searchParams: { orderNumber?: string; email?: string };
}) {
  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-8 sm:px-6 md:px-8">
      <Suspense
        fallback={
          <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-surface p-6 text-center shadow-[var(--shadow-soft)]">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Loading</p>
            <h1 className="mt-2 font-display text-3xl">Preparing checkout details</h1>
            <p className="mt-3 text-sm text-muted">Please wait while we load your secure checkout.</p>
          </div>
        }
      >
        <AwaitingPaymentClient
          orderNumber={searchParams.orderNumber ?? ""}
          email={searchParams.email ?? ""}
        />
      </Suspense>
    </main>
  );
}
