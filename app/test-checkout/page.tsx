import { notFound } from "next/navigation";
import { isProd } from "@/lib/utils/env";
import { TestCheckoutBootstrap } from "@/components/checkout/test-checkout-bootstrap";

export const metadata = {
  title: "Test checkout",
  robots: { index: false, follow: false },
};

export default function TestCheckoutPage() {
  if (isProd) {
    notFound();
  }

  return <TestCheckoutBootstrap />;
}
