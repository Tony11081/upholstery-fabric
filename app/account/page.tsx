import Link from "next/link";
import { format } from "date-fns";
import { OrderStatus, type Prisma } from "@prisma/client";
import { AccountSignIn } from "@/components/account/account-signin";
import { AccountProfileForm } from "@/components/account/profile-form";
import { ReferralCard } from "@/components/account/referral-card";
import { ReviewEligibleList, type ReviewEligibleItem } from "@/components/account/review-eligible-list";
import { ReorderActions } from "@/components/order/reorder-actions";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth/session";
import { resolveAuthEmailProviderConfig } from "@/lib/utils/email-config";
import { formatPrice } from "@/lib/utils/format";

export const metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AccountPageProps = {
  searchParams?: {
    callbackUrl?: string;
  };
};

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const session = await getAuthSession();

  if (!session?.user?.email) {
    const callbackUrl = searchParams?.callbackUrl ?? "/account";
    const emailEnabled = resolveAuthEmailProviderConfig().enabled;
    const googleEnabled = Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
    );

    return (
      <main className="min-h-screen bg-background px-4 pb-20 pt-10 sm:px-6 md:px-8">
        <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-border bg-surface p-6 text-center shadow-[var(--shadow-soft)]">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Account</p>
          <h1 className="font-display text-3xl">Sign in securely</h1>
          <p className="text-sm text-muted">
            Access your orders, saved lists, and delivery details.
          </p>
          <div className="pt-4 text-left">
            <AccountSignIn
              callbackUrl={callbackUrl}
              emailEnabled={emailEnabled}
              googleEnabled={googleEnabled}
            />
          </div>
        </div>
      </main>
    );
  }

  type OrderSummary = Prisma.OrderGetPayload<{
    include: { items: { include: { product: { include: { images: true } } } } };
  }>;
  type CustomerSummary = Prisma.CustomerGetPayload<{
    include: { vipTier: true };
  }>;
  let orders: OrderSummary[] = [];
  let customer: CustomerSummary | null = null;
  let reviewableItems: ReviewEligibleItem[] = [];
  try {
    orders = await prisma.order.findMany({
      where: { email: session.user.email.toLowerCase() },
      orderBy: { createdAt: "desc" },
      include: { items: { include: { product: { include: { images: { orderBy: { sortOrder: "asc" } } } } } } },
      take: 20,
    });
    customer = await prisma.customer.findUnique({
      where: { email: session.user.email.toLowerCase() },
      include: { vipTier: true },
    });

    const deliveredOrders = orders.filter((order) => order.status === OrderStatus.DELIVERED);
    const reviewableItemsMap = new Map<string, ReviewEligibleItem>();

    for (const order of deliveredOrders) {
      for (const item of order.items) {
        if (reviewableItemsMap.has(item.productId)) continue;
        reviewableItemsMap.set(item.productId, {
          productId: item.productId,
          slug: item.product.slug,
          title: item.titleSnapshot ?? item.product.titleEn,
          image: item.product.images[0]?.url ?? null,
          orderNumber: order.orderNumber,
          deliveredAt: format(new Date(order.updatedAt), "PP"),
        });
      }
    }

    reviewableItems = Array.from(reviewableItemsMap.values());

    if (customer?.id && reviewableItems.length > 0) {
      const existingReviews = await prisma.review.findMany({
        where: {
          customerId: customer.id,
          productId: { in: reviewableItems.map((item) => item.productId) },
        },
        select: { productId: true },
      });
      const reviewedIds = new Set(existingReviews.map((review) => review.productId));
      reviewableItems = reviewableItems.filter((item) => !reviewedIds.has(item.productId));
    }
  } catch (error) {
    console.error("Account orders lookup failed", error);
  }

  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-8 sm:px-6 md:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Account</p>
          <h1 className="font-display text-3xl leading-tight">Welcome, {session.user.name ?? "Guest"}</h1>
          <p className="text-sm text-muted">{session.user.email}</p>
        </div>

        <section className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">Recent orders</h2>
            <Link href="/track-order" className="text-sm underline underline-offset-4">
              Track order
            </Link>
          </div>
          {orders.length === 0 ? (
            <p className="text-sm text-muted">No orders yet. Confirmed orders will appear here.</p>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border">
              {orders.map((order) => {
                const reorderItems = order.items.map((item) => ({
                  productId: item.productId,
                  slug: item.product.slug,
                  title: item.titleSnapshot ?? item.product.titleEn,
                  price: Number(item.price),
                  currency: item.currency,
                  image: item.product.images[0]?.url ?? null,
                  quantity: item.qty,
                }));
                return (
                  <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                    <div>
                      <p className="font-medium">{order.orderNumber}</p>
                      <p className="text-xs text-muted">
                        {format(new Date(order.createdAt), "PP")} | {order.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <ReorderActions items={reorderItems} label="Reorder" />
                      <div className="font-semibold">{formatPrice(Number(order.total), order.currency)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">Reviews</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-muted">After delivery</span>
          </div>
          {reviewableItems.length === 0 ? (
            <p className="text-sm text-muted">
              Reviews unlock after delivery. Share feedback once your order arrives.
            </p>
          ) : (
            <ReviewEligibleList items={reviewableItems} defaultEmail={session.user.email} />
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">Aftercare</h2>
            <Link href="/help" className="text-sm underline underline-offset-4">
              Concierge support
            </Link>
          </div>
          <p className="text-sm text-muted">
            Receive care tips, styling suggestions, and exclusive offers from our concierge.
          </p>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/editorial" className="rounded-full border border-border px-4 py-2">
              Care notes
            </Link>
            <Link href="/search?sort=newest" className="rounded-full border border-border px-4 py-2">
              New arrivals
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
            <h3 className="font-display text-lg">VIP status</h3>
            <p className="mt-2 text-sm text-muted">Points and tier benefits update after each confirmed order.</p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">Tier</span>
                <span className="font-medium">{customer?.vipTier?.name ?? "Member"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Points</span>
                <span className="font-medium">{customer?.points ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Lifetime value</span>
                <span className="font-medium">
                  {formatPrice(Number(customer?.lifetimeValue ?? 0), "USD")}
                </span>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
            <h3 className="font-display text-lg">Profile</h3>
            <p className="mt-2 text-sm text-muted">Keep your details updated for faster checkout.</p>
            <div className="mt-4">
              <AccountProfileForm
                initial={{
                  name: customer?.name ?? session.user.name ?? null,
                  phone: customer?.phone ?? null,
                  birthday: customer?.birthday ? customer.birthday.toISOString().slice(0, 10) : null,
                  preferences: (customer?.preferences as Record<string, unknown>) ?? null,
                  sizes: (customer?.sizes as Record<string, unknown>) ?? null,
                }}
              />
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
            <h3 className="font-display text-lg">Addresses</h3>
            <p className="mt-2 text-sm text-muted">Manage delivery and billing addresses.</p>
          </div>
          <ReferralCard />
        </section>
      </div>
    </main>
  );
}
