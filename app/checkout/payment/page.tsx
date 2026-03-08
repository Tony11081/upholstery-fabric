import { redirect } from "next/navigation";

export const metadata = {
  title: "Checkout - Secure",
  robots: { index: false, follow: false },
};

export default function CheckoutPaymentPage() {
  redirect("/checkout/address");
}
