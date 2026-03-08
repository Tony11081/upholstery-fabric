import Link from "next/link";
import { headers } from "next/headers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default async function NotFound() {
  const headerList = await headers();
  const referer = headerList.get("referer") ?? "direct";
  const host = headerList.get("host") ?? "unknown";

  console.warn("[not-found]", { host, referer });

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-ink">
      <div className="max-w-sm space-y-4 rounded-xl border border-border bg-surface px-6 py-8 shadow-[var(--shadow-soft)]">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">404</p>
        <h1 className="font-display text-2xl">Page not found</h1>
        <p className="text-sm text-muted">
          The page you&apos;re looking for isn&apos;t available. Try searching or return to the homepage.
        </p>
        <div className="flex flex-col gap-2">
          <Link href="/search" className="text-sm font-medium underline underline-offset-4">
            Search products
          </Link>
          <Link href="/" className="text-sm font-medium underline underline-offset-4">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
