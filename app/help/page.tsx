import Link from "next/link";
import { Mail, ArrowUpRight } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";
import { ConciergeCard } from "@/components/concierge/concierge-card";

const faqs = [
  {
    question: "How does checkout work?",
    answer:
      "Add items to your bag, enter delivery details, and complete checkout on our secure hosted page. You will receive an order confirmation by email.",
  },
  {
    question: "Where can I track my order?",
    answer:
      "Use the Track Order page with your order number and email. Updates appear as soon as the carrier scans your parcel.",
  },
  {
    question: "What shipping options are available?",
    answer:
      "Standard tracked shipping is offered at checkout. Estimated delivery windows appear before you confirm. Orders over $120 ship free.",
  },
  {
    question: "Can I update my order details?",
    answer:
      "Contact concierge as soon as possible and we will do our best to help before your order ships.",
  },
];

export const metadata = {
  title: "Help Center",
};

export default function HelpPage() {
  const supportEmail = process.env.SUPPORT_EMAIL ?? "support@moppetbrandname.shop";

  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-10 sm:px-6 md:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <SectionHeading
          eyebrow="Help Center"
          title="Support at every step"
          description="Find quick answers, track shipments, or reach our concierge team for personal assistance."
          action={(
            <Link
              href="/track-order"
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium"
            >
              Track order
              <ArrowUpRight size={14} />
            </Link>
          )}
        />

        <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
          <section className="space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)]"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-ink">
                  {faq.question}
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted group-open:text-ink">
                    Toggle
                  </span>
                </summary>
                <p className="mt-3 text-sm text-muted">{faq.answer}</p>
              </details>
            ))}
          </section>

          <aside className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Contact</p>
            <h2 className="font-display text-xl">Concierge support</h2>
            <p className="text-sm text-muted">
              Email us anytime and we will respond within one business day.
            </p>
            <Link
              href={`mailto:${supportEmail}`}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium"
            >
              <Mail size={16} />
              {supportEmail}
            </Link>
            <div className="text-xs text-muted">
              Review store policies in{" "}
              <Link href="/policies" className="underline underline-offset-4">
                Policies
              </Link>
              .
            </div>
          </aside>
          <ConciergeCard compact context={{ source: "help_center" }} />
        </div>
      </div>
    </main>
  );
}
