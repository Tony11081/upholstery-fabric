import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-ink">
      <div className="max-w-sm space-y-4 rounded-xl border border-border bg-surface px-6 py-8 shadow-[var(--shadow-soft)]">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Product</p>
        <h1 className="font-display text-2xl">Not found</h1>
        <p className="text-sm text-muted">
          The product you&apos;re looking for isn&apos;t available. Browse the latest arrivals instead.
        </p>
        <Link href="/" className="text-sm font-medium underline underline-offset-4">
          Back to home
        </Link>
      </div>
    </main>
  );
}
