import Link from "next/link";
import { ReferralCard } from "@/components/account/referral-card";

export const metadata = {
  title: "Share",
  robots: { index: false, follow: false },
};

export default function SharePage() {
  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-10 sm:px-6 md:px-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-6 text-center shadow-[var(--shadow-soft)]">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Share</p>
          <h1 className="font-display text-3xl">Invite a friend</h1>
          <p className="text-sm text-muted">
            Share your curated edit. Friends receive a welcome credit and you earn when they place an order.
          </p>
          <div className="pt-4">
            <Link href="/" className="text-sm underline underline-offset-4">
              Back to home
            </Link>
          </div>
        </div>
        <ReferralCard />
      </div>
    </main>
  );
}


