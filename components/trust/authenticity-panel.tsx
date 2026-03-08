"use client";

import { ShieldCheck, Gem, FileCheck } from "lucide-react";

const steps = [
  {
    icon: ShieldCheck,
    title: "Specialist inspection",
    body: "Every item is inspected for materials, finish, and condition.",
  },
  {
    icon: Gem,
    title: "Condition transparency",
    body: "We document condition notes and care details for your order.",
  },
  {
    icon: FileCheck,
    title: "Final quality check",
    body: "Final inspection covers stitching, hardware, and packaging.",
  },
];

export function AuthenticityPanel() {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Quality assurance</p>
        <h3 className="font-display text-xl">Inspected with care</h3>
        <p className="text-sm text-muted">
          Each piece ships with an inspection record and care notes.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {steps.map((step) => (
          <div key={step.title} className="rounded-xl border border-border bg-contrast p-4">
            <step.icon className="text-ink" size={18} />
            <p className="mt-3 text-sm font-medium text-ink">{step.title}</p>
            <p className="mt-1 text-xs text-muted">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
