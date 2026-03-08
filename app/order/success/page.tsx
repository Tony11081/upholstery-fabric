import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import Stripe from "stripe";
import {
  createOrder,
  getOrderByNumberAndEmail,
  orderWithRelationsInclude,
  type OrderWithRelations,
} from "@/lib/data/orders";
import { prisma } from "@/lib/prisma";
import { isProd } from "@/lib/utils/env";
import { formatPrice } from "@/lib/utils/format";
import { STRIPE_API_VERSION, generateOrderNumber, safeJson } from "@/lib/utils/stripe";
import { resolveImageUrl } from "@/lib/utils/image";
import { ReorderActions } from "@/components/order/reorder-actions";

type Props = {
  searchParams: { session_id?: string; orderNumber?: string; email?: string };
};

export const metadata = {
  title: "Order Success",
  robots: { index: false, follow: false },
};

const ORDER_INCLUDE = orderWithRelationsInclude satisfies Prisma.OrderInclude;

export default async function OrderSuccessPage({ searchParams }: Props) {
  const { session_id: sessionId, orderNumber: orderNumberParam, email: emailParam } = searchParams;
  let order: OrderWithRelations | null = null;
  let processingNote: string | null = null;
  let lookupError: string | null = null;

  if (sessionId) {
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      processingNote = "Checkout is not configured yet. Please contact support.";
      if (isProd) {
        console.error("Stripe secret missing for order success resolution");
      }
    } else {
      try {
        const stripe = new Stripe(stripeSecret, { apiVersion: STRIPE_API_VERSION });
        const session = (await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ["line_items", "line_items.data.price.product"],
        })) as Stripe.Checkout.Session;
        const shippingDetails = (session as Stripe.Checkout.Session & {
          shipping_details?: Stripe.Checkout.Session.CollectedInformation.ShippingDetails | null;
        }).shipping_details;
        const customerDetails =
          (session as Stripe.Checkout.Session & {
            customer_details?: Stripe.Checkout.Session.CustomerDetails | null;
          }).customer_details ?? session.customer_details;
        let utm: Prisma.InputJsonValue | undefined;
        if (session.metadata?.utm) {
          try {
            utm = JSON.parse(session.metadata.utm);
          } catch {
            utm = undefined;
          }
        }

        const email = (session.customer_details?.email ?? session.customer_email ?? emailParam ?? "").toLowerCase();
        const orderNumber = session.metadata?.orderNumber ?? generateOrderNumber();

        const existing = await prisma.order.findFirst({
          where: { stripeSessionId: sessionId },
          include: ORDER_INCLUDE,
        });

        if (existing) {
          order = existing;
        } else {
          const subtotal = (session.amount_subtotal ?? 0) / 100;
          const total = (session.amount_total ?? 0) / 100;
          const shippingTotal = (session.total_details?.amount_shipping ?? 0) / 100;
          const discountTotal = (session.total_details?.amount_discount ?? 0) / 100;
          const lineItems = session.line_items?.data ?? [];

          const orderItems = lineItems.map((item) => ({
            productId: ((item.price?.product as Stripe.Product)?.metadata?.productId as string) ?? "",
            qty: item.quantity ?? 1,
            price: (item.price?.unit_amount ?? 0) / 100,
            currency: session.currency?.toUpperCase() ?? "USD",
            titleSnapshot: item.description ?? item.price?.nickname ?? "",
          }));

          if (orderItems.some((item) => !item.productId)) {
            throw new Error("Missing product metadata on Stripe line item");
          }

          try {
            order = await createOrder({
              email,
              stripeSessionId: sessionId,
              orderNumber,
              subtotal,
              shippingTotal,
              discountTotal,
              taxTotal: 0,
              total,
              currency: session.currency?.toUpperCase() ?? "USD",
              shippingAddress: safeJson(shippingDetails),
              billingAddress: safeJson(customerDetails),
              paymentMethod: "stripe",
              source: session.metadata?.source ?? "stripe",
              utm,
              referralCode: session.metadata?.referralCode ?? null,
              items: orderItems,
              tracking: {
                carrier: "DHL",
                trackingNumber: "STRIPE-" + session.id.slice(-6),
                statusHistory: [
                  {
                    timestamp: new Date().toISOString(),
                    status: "LABEL_CREATED",
                    message: "Order placed",
                  },
                ],
              },
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes("stripeSessionId") || message.includes("Unique constraint")) {
              order = await prisma.order.findFirst({
                where: { stripeSessionId: sessionId },
                include: ORDER_INCLUDE,
              });
            } else {
              processingNote = "We're finalizing your order. This can take a few seconds if the webhook is delayed.";
            }
          }
        }
      } catch (error) {
        console.error("Order success resolution failed", error);
        processingNote = "We could not confirm your checkout yet. Please refresh in a few seconds.";
      }
    }
  }

  if (!order && orderNumberParam && emailParam) {
    try {
      order = await getOrderByNumberAndEmail(orderNumberParam, emailParam);
    } catch (error) {
      console.error("Order lookup failed", error);
      lookupError = "Unable to load your order right now. Please try again later.";
    }
  }

  if (!order && !isProd) {
    try {
      order = await getOrderByNumberAndEmail("UOOTD-24001", "guest@uootd.com");
    } catch {
      // ignore dev fallback failure
    }
  }

  if (!order) {
    if (sessionId) {
      const note = processingNote ?? lookupError;
      return (
        <main className="min-h-screen bg-background px-4 pb-20 pt-10 sm:px-6 md:px-8">
          <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-border bg-surface p-6 text-center shadow-[var(--shadow-soft)]">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Processing</p>
            <h1 className="font-display text-3xl">Finalizing your order</h1>
            <p className="text-sm text-muted">
              We&apos;re confirming your checkout now. If this page doesn&apos;t refresh automatically, you can revisit it in a few
              seconds. Session: {sessionId}
            </p>
            {note && <p className="text-sm text-muted">{note}</p>}
            <div className="pt-4">
              <Link href="/" className="text-sm underline underline-offset-4">
                Continue browsing
              </Link>
            </div>
          </div>
        </main>
      );
    }
    if (lookupError) {
      return (
        <main className="min-h-screen bg-background px-4 pb-20 pt-10 sm:px-6 md:px-8">
          <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-border bg-surface p-6 text-center shadow-[var(--shadow-soft)]">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Order lookup</p>
            <h1 className="font-display text-3xl">Unable to load order</h1>
            <p className="text-sm text-muted">{lookupError}</p>
            <div className="pt-4">
              <Link href="/track-order" className="text-sm underline underline-offset-4">
                Try tracking again
              </Link>
            </div>
          </div>
        </main>
      );
    }
    notFound();
  }

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
    <main className="min-h-screen bg-background px-4 pb-20 pt-10 sm:px-6 md:px-8">
      <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-soft)]">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Thank you</p>
          <h1 className="font-display text-3xl">Order confirmed - preparing dispatch</h1>
          <p className="text-sm text-muted">
            Order {order.orderNumber} | {order.email} | {format(new Date(order.createdAt ?? new Date()), "PP")}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-contrast px-4 py-3 text-sm text-muted">
          We&apos;ve emailed your confirmation. Tracking will appear as soon as your parcel ships.
        </div>

        <div className="divide-y divide-border rounded-xl border border-border">
          {order.items.map((item) => {
            const cover = item.product.images[0];
            const coverUrl = resolveImageUrl(cover?.url);
            return (
              <div key={item.id} className="flex items-center gap-4 p-4">
                {coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverUrl}
                    alt={cover?.alt ?? item.titleSnapshot ?? item.product.titleEn}
                    className="h-16 w-14 rounded-md border border-border object-cover"
                    loading="lazy"
                  />
                )}
                <div className="flex flex-1 flex-col">
                  <span className="font-medium">{item.titleSnapshot ?? item.product.titleEn}</span>
                  <span className="text-xs text-muted">Qty {item.qty}</span>
                </div>
                <span className="text-sm font-semibold">
                  {formatPrice(Number(item.price), item.currency)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/track-order?orderNumber=${order.orderNumber}&email=${order.email}`}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium"
          >
            Track order
          </Link>
          <ReorderActions items={reorderItems} />
          <Link href="/" className="text-sm underline underline-offset-4">
            Continue shopping
          </Link>
        </div>
      </div>
    </main>
  );
}
