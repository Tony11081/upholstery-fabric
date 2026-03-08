"use client";

const steps = [
  {
    title: "Submit request",
    body: "Request a return within 14 days using your order number and email.",
  },
  {
    title: "Schedule pickup",
    body: "We confirm a pickup window and carrier details.",
  },
  {
    title: "Inspection",
    body: "Items are reviewed for condition and order details.",
  },
  {
    title: "Refund or exchange",
    body: "Once approved, refunds or exchanges are processed within 5-7 business days.",
  },
];

export function ReturnsTimeline() {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Returns</p>
        <h3 className="font-display text-xl">Clear return guidance</h3>
        <p className="text-sm text-muted">
          We keep the process clear so you know what to expect at every step.
        </p>
      </div>
      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-3 rounded-xl border border-border bg-contrast p-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-xs font-semibold text-ink">
              {index + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-ink">{step.title}</p>
              <p className="text-xs text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
