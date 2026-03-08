import type { Prisma } from "@prisma/client";
import Stripe from "stripe";
import { createOrder } from "@/lib/data/orders";
import { prisma } from "@/lib/prisma";
import { isProd } from "@/lib/utils/env";
import { STRIPE_API_VERSION, safeJson } from "@/lib/utils/stripe";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";
import { buildOrderStatusEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email";
import { getSiteUrl } from "@/lib/utils/site";

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeSecret || !webhookSecret) {
    const message = "Stripe webhook secret missing";
    logApiError(ctx, 500, new Error(message));
    return jsonError(message, 500, ctx);
  }

  const rawBody = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    logApiWarning(ctx, 400, { reason: "missing_signature" });
    return jsonError("Missing Stripe signature", 400, ctx);
  }

  try {
    const stripe = new Stripe(stripeSecret, { apiVersion: STRIPE_API_VERSION });
    const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { expand: ["data.price.product"] });
      const shippingDetails = (session as Stripe.Checkout.Session & {
        shipping_details?: Stripe.Checkout.Session.CollectedInformation.ShippingDetails | null;
      }).shipping_details;
      const customerDetails =
        (session as Stripe.Checkout.Session & {
          customer_details?: Stripe.Checkout.Session.CustomerDetails | null;
        }).customer_details ?? session.customer_details;

      const subtotal = (session.amount_subtotal ?? 0) / 100;
      const total = (session.amount_total ?? 0) / 100;
      const shippingTotal = (session.total_details?.amount_shipping ?? 0) / 100;
      const discountTotal = (session.total_details?.amount_discount ?? 0) / 100;

      const orderNumber =
        session.metadata?.orderNumber ??
        `UOOTD-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.floor(
          Math.random() * 90000 + 10000,
        )}`;
      let utm: Prisma.InputJsonValue | undefined;
      if (session.metadata?.utm) {
        try {
          utm = JSON.parse(session.metadata.utm);
        } catch {
          utm = undefined;
        }
      }

      // Prevent duplicate creation
      const existing = await prisma.order.findFirst({ where: { stripeSessionId: session.id } });
      if (existing) {
        logApiSuccess(ctx, 200, { event: event.type, sessionId: session.id, duplicate: true });
        return jsonOk({ received: true }, ctx);
      }

      const orderItems = lineItems.data.map((item) => ({
        productId: (item.price?.product as Stripe.Product)?.metadata?.productId ?? "",
        qty: item.quantity ?? 1,
        price: (item.price?.unit_amount ?? 0) / 100,
        currency: session.currency?.toUpperCase() ?? "USD",
        titleSnapshot: item.description ?? item.price?.nickname ?? "",
      }));

      if (orderItems.some((item) => !item.productId)) {
        throw new Error("Line item missing product metadata");
      }

      const order = await createOrder({
        email: (session.customer_details?.email ?? session.customer_email ?? "").toLowerCase(),
        stripeSessionId: session.id,
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
        source: session.metadata?.source || "stripe",
        utm,
        referralCode: session.metadata?.referralCode || null,
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

      const trackUrl = `${getSiteUrl()}/track-order?orderNumber=${order.orderNumber}&email=${encodeURIComponent(order.email)}`;
      const emailTemplate = buildOrderStatusEmail({
        orderNumber: order.orderNumber,
        status: "CONFIRMED",
        items: order.items.map((item) => ({
          title: item.titleSnapshot ?? "Item",
          qty: item.qty,
          price: Number(item.price),
          currency: item.currency,
        })),
        trackUrl,
        trackingNumber: order.shipments[0]?.trackingNumber,
        carrier: order.shipments[0]?.carrier,
      });
      try {
        await sendEmail({
          to: order.email,
          subject: emailTemplate.subject,
          text: emailTemplate.text,
          html: emailTemplate.html,
        });
      } catch (emailError) {
        logApiError(ctx, 500, emailError, { sessionId: session.id, reason: "order_email_failed" });
      }
    }

    logApiSuccess(ctx, 200, { event: event.type });
    return jsonOk({ received: true }, ctx);
  } catch (err) {
    if (!isProd) {
      logApiError(ctx, 400, err);
      return jsonError("Webhook failed", 400, ctx, { details: String(err) });
    }
    logApiError(ctx, 400, err);
    return jsonError("Webhook failed", 400, ctx);
  }
}
