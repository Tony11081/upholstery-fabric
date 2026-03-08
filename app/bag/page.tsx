import { BagClient } from "@/components/bag/bag-client";

export const metadata = {
  title: "Bag",
  robots: { index: false, follow: false },
};

export default function BagPage() {
  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-4 sm:px-6 md:px-8">
      <BagClient />
    </main>
  );
}


