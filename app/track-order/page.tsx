import { TrackOrderClient } from "@/components/order/track-order-client";

export const metadata = {
  title: "Track Order",
  robots: { index: false, follow: false },
};

export default function TrackOrderPage({
  searchParams,
}: {
  searchParams: { orderNumber?: string; email?: string };
}) {
  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-8 sm:px-6 md:px-8">
      <TrackOrderClient
        initialOrderNumber={searchParams.orderNumber ?? ""}
        initialEmail={searchParams.email ?? ""}
      />
    </main>
  );
}


