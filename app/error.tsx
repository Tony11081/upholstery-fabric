"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-ink">
      <div className="max-w-sm space-y-4 rounded-xl border border-border bg-surface px-6 py-8 shadow-[var(--shadow-soft)]">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Error</p>
        <h1 className="font-display text-2xl">Something went wrong</h1>
        <p className="text-sm text-muted">
          Please try again. If the issue persists, contact support with the reference below.
        </p>
        {error.digest && (
          <p className="text-xs text-muted">Ref: {error.digest}</p>
        )}
        <div className="flex flex-col gap-2">
          <Button onClick={() => reset()} className="rounded-full">
            Try again
          </Button>
          <Link href="/" className="text-sm font-medium underline underline-offset-4">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
