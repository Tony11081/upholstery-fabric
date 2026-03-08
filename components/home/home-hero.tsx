"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Heart, Search, Share2, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/lib/hooks/useToast";

type HeroProps = {
  stats: {
    total: number;
    newCount: number;
    lastUpdated: Date | null;
  };
  overlay?: ReactNode;
};

export function HomeHero({ stats, overlay }: HeroProps) {
  const { toast } = useToast();
  const updatedLabel = stats.lastUpdated
    ? `Updated ${formatDistanceToNow(stats.lastUpdated, { addSuffix: true })}`
    : "Updated today";

  return (
    <section className="relative overflow-hidden rounded-b-[28px] border border-border bg-surface shadow-[var(--shadow-soft)]">
      <div className="absolute inset-0">
        <Image
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuByAB1cN3FM0DNUb0hC44tkcsQUQik1jYxkl4zyeENc3wDUH1IobTV9Ywv6bYXjqZ_1xt_Sp9oW7Dzu11UL4AsFWPKBbm-sGKDi_vEu98-bwV6Lus9pSt6ehODppKiYqNwYfZAHBFwAXAi8k-_rKbWGsFTfI85U-qSiNrHpYqewXXQ9y5BTh_iHMWlyCNX--__NX8lc7cSHomfdd6YErUuqZBrkj-r7gTLaS0TgNCtRLnNK3d3AsNzBC5nnKt7NDcRyGKYmXhT2g98"
          alt="Editorial background"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/25 to-background/40" />
      </div>

      <div className="relative z-10 px-4 pb-10 pt-4 sm:px-6 md:px-8">
        <div className="flex items-center justify-between text-surface">
          <button
            type="button"
            onClick={() =>
            toast({
              title: "Archive-grade sourcing",
              description: "Each fabric lot is checked for handfeel, weave, weight, and visible defects before shipping.",
              variant: "info",
            })
          }
          className="rounded-full bg-black/40 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] shadow-[var(--shadow-float)] backdrop-blur-md"
        >
          Archive-grade sourcing
        </button>
          <div className="flex items-center gap-3">
            <IconCircle href="/search" label="Search">
              <Search size={16} />
            </IconCircle>
            <IconCircle href="/share" label="Share">
              <Share2 size={16} />
            </IconCircle>
            <IconCircle href="/wishlist" label="Wishlist">
              <Heart size={16} />
            </IconCircle>
            <IconCircle href="/bag" label="Bag">
              <ShoppingBag size={16} />
            </IconCircle>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-full bg-white/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink shadow-[var(--shadow-float)]">
            Complimentary swatch card with first order
          </span>
        </div>

        {overlay}

        <div className="mt-20 space-y-3 text-center text-surface drop-shadow">
          <p className="text-sm uppercase tracking-[0.32em] text-surface/80">
            Luxury maison fabric archive
          </p>
          <h1 className="font-display text-4xl sm:text-5xl">Atelier Fabrics</h1>
          <p className="text-lg text-surface/90">
            Source premium tweed, silk, jacquard, coating, lining, and upholstery fabrics by the meter.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs uppercase tracking-[0.18em] text-surface/80">
          <span className="flex items-center gap-1">
            <strong className="text-surface">{stats.newCount.toLocaleString()}</strong>
            <span>New</span>
          </span>
          <span className="text-surface/50">|</span>
          <span className="flex items-center gap-1">
            <strong className="text-surface">{stats.total.toLocaleString()}</strong>
            <span>Total</span>
          </span>
          <span className="text-surface/50">|</span>
          <span>{updatedLabel}</span>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="#catalog"
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink shadow-[var(--shadow-float)] transition hover:bg-white/90"
          >
            Shop fabrics
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/categories"
            className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-black/25 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-black/40"
          >
            Browse fabric types
          </Link>
        </div>

        <div className="mt-4 text-center text-[11px] uppercase tracking-[0.18em] text-surface/85">
          Swatch support · Global delivery for studio and residential orders
        </div>
      </div>
    </section>
  );
}

function IconCircle({
  children,
  href,
  label,
}: {
  children: ReactNode;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-surface shadow-[var(--shadow-float)] backdrop-blur-md transition hover:bg-black/50",
      )}
    >
      {children}
    </Link>
  );
}
