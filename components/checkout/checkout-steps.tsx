type StepKey = "address" | "payment";

const steps: Array<{ key: StepKey; label: string }> = [
  { key: "address", label: "Address" },
  { key: "payment", label: "Payment" },
];

export function CheckoutSteps({ current }: { current: StepKey }) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.key === current),
  );

  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted">
      {steps.map((step, index) => {
        const isActive = index === currentIndex;
        const isComplete = index < currentIndex;
        return (
          <span
            key={step.key}
            className={`rounded-full border px-3 py-1 ${
              isActive
                ? "border-ink bg-ink text-background"
                : isComplete
                  ? "border-ink text-ink"
                  : "border-border"
            }`}
            aria-current={isActive ? "step" : undefined}
          >
            {step.label}
          </span>
        );
      })}
    </div>
  );
}
