import Image from "next/image";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth/session";
import { formatPrice } from "@/lib/utils/format";
import { resolveImageUrl } from "@/lib/utils/image";

export const metadata = {
  title: "Wishlist",
  robots: { index: false, follow: false },
};

export default async function WishlistPage() {
  const session = await getAuthSession();

  if (!session?.user?.email) {
    return (
      <main className="min-h-screen bg-background px-4 pb-20 pt-10 sm:px-6 md:px-8">
        <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-border bg-surface p-6 text-center shadow-[var(--shadow-soft)]">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Wishlist</p>
          <h1 className="font-display text-3xl">Sign in to save your edit</h1>
          <p className="text-sm text-muted">
            Create a curated wishlist to revisit favorite pieces anytime.
          </p>
          <div className="pt-4">
            <Link
              href="/account?callbackUrl=/wishlist"
              className="rounded-full border border-border px-4 py-2 text-sm font-medium"
            >
              Sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  type WishlistItemWithProduct = Prisma.WishlistItemGetPayload<{
    include: {
      product: { include: { images: true; category: true } };
    };
  }>;

  let items: WishlistItemWithProduct[] = [];
  let hasError = false;

  try {
    items = await prisma.wishlistItem.findMany({
      where: { user: { email: session.user.email.toLowerCase() } },
      include: {
        product: {
          include: {
            images: { orderBy: { sortOrder: "asc" } },
            category: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  } catch (error) {
    console.error("Wishlist load failed", error);
    hasError = true;
  }

  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-8 sm:px-6 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Wishlist</p>
          <h1 className="font-display text-3xl leading-tight">Saved pieces</h1>
          <p className="text-sm text-muted">{session.user.email}</p>
        </div>

        {hasError ? (
          <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
            We could not load your wishlist right now. Please refresh.
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-6 text-center shadow-[var(--shadow-soft)]">
            <p className="text-sm text-muted">No pieces saved yet.</p>
            <div className="pt-4">
              <Link href="/" className="text-sm underline underline-offset-4">
                Browse the edit
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((item) => {
              const cover = item.product.images[0];
              const coverUrl = resolveImageUrl(cover?.url);
              return (
                <Link
                  key={item.id}
                  href={`/product/${item.product.slug}`}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)] transition hover:border-ink/70"
                >
                  <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-border bg-contrast">
                    {coverUrl ? (
                      <Image
                        src={coverUrl}
                        alt={cover?.alt ?? item.product.titleEn}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted">
                        Image coming soon
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">{item.product.titleEn}</span>
                    <span className="text-xs uppercase tracking-[0.18em] text-muted">
                      {item.product.category?.nameEn ?? "Product"}
                    </span>
                  </div>
                  <span className="text-sm font-semibold">
                    {formatPrice(Number(item.product.price), item.product.currency)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}


