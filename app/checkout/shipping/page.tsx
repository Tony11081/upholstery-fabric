import { redirect } from "next/navigation";

export const metadata = {
  title: "Checkout - Delivery",
  robots: { index: false, follow: false },
};

export default function CheckoutShippingPage() {
  redirect("/checkout/address");
}

