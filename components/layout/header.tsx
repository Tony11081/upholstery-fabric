"use client";

import Link from "next/link";
import { Search, Share2, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/lib/hooks/useToast";

export function Header({ className }: { className?: string }) {
  const { toast } = useToast();
  return (
    <header
      className={cn("absolute inset-x-0 top-0 z-40 px-4 py-3 sm:px-6 md:px-8", className)}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <button
          type="button"
          onClick={() =>
            toast({
              title: "Archive-grade sourcing",
              description: "Every lot is checked for weave, handfeel, and visible defects before dispatch.",
              variant: "info",
            })
          }
          className="rounded-full bg-black/40 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white shadow-[var(--shadow-float)] backdrop-blur-md"
        >
          Archive-grade sourcing
        </button>
        <div className="flex items-center gap-2 text-white">
          <IconCircle href="/search">
            <Search size={16} />
          </IconCircle>
          <IconCircle href="/share">
            <Share2 size={16} />
          </IconCircle>
          <IconCircle href="/bag">
            <ShoppingBag size={16} />
          </IconCircle>
        </div>
      </div>
    </header>
  );
}

function IconCircle({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white shadow-[var(--shadow-float)] backdrop-blur-md transition hover:bg-black/50"
    >
      {children}
    </Link>
  );
}
