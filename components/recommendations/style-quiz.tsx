"use client";

const announcements = [
  { label: "Curated", text: "New arrivals selected daily" },
  { label: "Shipping", text: "Complimentary shipping over $120" },
  { label: "Service", text: "Concierge support from real advisors" },
  { label: "Quality", text: "Multi-step inspection before dispatch" },
];

export function StyleQuiz() {
  const messages = [...announcements, ...announcements];

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted">
          <span className="inline-flex h-2 w-2 rounded-full bg-ink/70 animate-pulse" />
          <span>Client updates</span>
        </div>
        <span className="rounded-full border border-border bg-contrast px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-ink">
          Live
        </span>
      </div>

      <div className="relative mt-3 overflow-hidden rounded-full border border-border bg-contrast">
        <div className="marquee-track flex w-max items-center gap-6 py-2">
          {messages.map((item, index) => (
            <div
              key={`${item.label}-${index}`}
              className="flex items-center gap-2 px-4 text-xs uppercase tracking-[0.18em] text-ink"
            >
              <span className="text-muted">{item.label}</span>
              <span className="text-muted">|</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .marquee-track {
          animation: marquee 24s linear infinite;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </section>
  );
}
