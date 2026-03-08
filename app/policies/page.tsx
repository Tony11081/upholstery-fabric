export const metadata = {
  title: "Policies",
};

export default function PoliciesPage() {
  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-8 sm:px-6 md:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Policies</p>
          <h1 className="font-display text-3xl leading-tight">Shipping and returns</h1>
          <p className="text-sm text-muted">
            We keep our policies clear and transparent. Please review the details below.
          </p>
        </div>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
          <h2 className="font-display text-xl">Shipping</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>Standard delivery: 3-5 business days.</li>
            <li>Complimentary shipping over $120.</li>
            <li>Expedited delivery can be arranged via concierge where available.</li>
            <li>Tracking is provided for every shipment.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
          <h2 className="font-display text-xl">Returns</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>Returns accepted within 14 days of delivery.</li>
            <li>Items must be unused and in original packaging.</li>
            <li>Contact support before sending items back.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
          <h2 className="font-display text-xl">Support</h2>
          <p className="mt-3 text-sm text-muted">
            For help, reply to your confirmation email or contact our concierge team.
          </p>
        </section>

        <AuthenticityPanel />
        <ReturnsTimeline />
      </div>
    </main>
  );
}


import { AuthenticityPanel } from "@/components/trust/authenticity-panel";
import { ReturnsTimeline } from "@/components/trust/returns-timeline";
