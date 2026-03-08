import type { Prisma, Product } from "@prisma/client";
import Stripe from "stripe";
import { createOrder } from "@/lib/data/orders";
import { filterMockProducts } from "@/lib/data/products";
import { mockOrder } from "@/lib/data/mock-orders";
import { prisma } from "@/lib/prisma";
import { isInvoiceMode, isProd } from "@/lib/utils/env";
import { STRIPE_API_VERSION, generateOrderNumber } from "@/lib/utils/stripe";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning, maskEmail } from "@/lib/utils/api";
import { applyDiscount, getActiveDiscounts, resolveDiscountPercent } from "@/lib/utils/discounts";
import { calculateShipping } from "@/lib/utils/shipping";

type CheckoutItem = {
  productId: string;
  quantity: number;
};

type CheckoutPayload = {
  items: Array<{ productId?: string; quantity?: number }>;
  address?: { email?: string; [key: string]: unknown };
  shipping?: { price?: number; [key: string]: unknown };
  referralCode?: string;
  source?: string;
  utm?: Prisma.InputJsonValue;
};

const ALLOWED_COUNTRIES: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] = [
  "US",
  "CA",
  "GB",
  "FR",
  "DE",
  "ES",
  "IT",
];

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  if (isInvoiceMode) {
    logApiWarning(ctx, 400, { reason: "invoice_mode_active" });
    return jsonError("Stripe checkout is disabled in invoice mode", 400, ctx);
  }
  let body: CheckoutPayload;
  try {
    body = (await request.json()) as CheckoutPayload;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx);
  }
  const { items, address, referralCode, source, utm } = body ?? {};

  if (!Array.isArray(items) || items.length === 0) {
    logApiWarning(ctx, 400, { reason: "empty_bag" });
    return jsonError("Bag is empty", 400, ctx);
  }

  const normalizedItems: CheckoutItem[] = items
    .map((item) => ({
      productId: item?.productId ?? "",
      quantity: Number(item?.quantity) || 1,
    }))
    .filter((item: CheckoutItem) => !!item.productId);

  if (normalizedItems.length === 0) {
    logApiWarning(ctx, 400, { reason: "missing_products" });
    return jsonError("Products are missing from the request", 400, ctx);
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    request.headers.get("origin") ??
    (isProd ? null : "http://localhost:3000");
  if (!siteUrl) {
    logApiError(ctx, 500, new Error("Site URL not configured"));
    return jsonError("Site URL is not configured", 500, ctx);
  }
  const orderNumber = generateOrderNumber();
  const stripeSecret = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecret) {
    if (isProd) {
      logApiError(ctx, 500, new Error("Stripe secret missing"));
      return jsonError("Stripe secret missing", 500, ctx);
    }
    const order = await mockCreateOrder(normalizedItems, {
      address,
      orderNumber,
      referralCode,
      source,
      utm,
    });
    logApiWarning(ctx, 200, {
      orderNumber,
      items: normalizedItems.length,
      email: maskEmail(address?.email),
      fallback: "mock",
    });
    return jsonOk({ orderNumber: order.orderNumber }, ctx);
  }

  try {
    const stripe = new Stripe(stripeSecret, { apiVersion: STRIPE_API_VERSION });
    const uniqueProductIds = Array.from(new Set(normalizedItems.map((item) => item.productId)));

    const dbProducts: (Product & { images: { url: string }[] })[] = await prisma.product.findMany({
      where: { id: { in: uniqueProductIds } },
      include: { images: true },
    });
    const discounts = await getActiveDiscounts();

    if (dbProducts.length !== uniqueProductIds.length) {
      logApiWarning(ctx, 400, { reason: "product_unavailable" });
      return jsonError("One or more products are unavailable", 400, ctx);
    }

    let subtotal = 0;
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = normalizedItems.map((item) => {
      const product = dbProducts.find((p) => p.id === item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      const discountPercent = resolveDiscountPercent(product.id, product.categoryId, discounts);
      const unitPrice = applyDiscount(Number(product.price), discountPercent);
      subtotal += unitPrice * item.quantity;
      const unitAmount = Math.round(unitPrice * 100);
      if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
        throw new Error(`Invalid price for product ${product.id}`);
      }

      return {
        quantity: item.quantity,
        price_data: {
          currency: (product.currency || "USD").toLowerCase(),
          unit_amount: unitAmount,
          product_data: {
            name: product.titleEn,
            images: product.images?.length ? [product.images[0].url] : undefined,
            metadata: {
              productId: product.id,
              slug: product.slug,
            },
          },
        },
      };
    });

    const utmPayload = utm ? JSON.stringify(utm) : "";
    const shippingTotal = calculateShipping(subtotal);
    const shippingAmount = Math.round(shippingTotal * 100);
    const shippingLabel = shippingTotal === 0 ? "Free shipping" : "Standard shipping";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: address?.email,
      success_url: `${siteUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/bag`,
      shipping_address_collection: { allowed_countries: ALLOWED_COUNTRIES },
      shipping_options: [
        {
          shipping_rate_data: {
            display_name: shippingLabel,
            type: "fixed_amount",
            fixed_amount: { amount: shippingAmount, currency: "usd" },
            delivery_estimate: {
              minimum: { unit: "business_day", value: 3 },
              maximum: { unit: "business_day", value: 5 },
            },
          },
        },
      ],
      line_items: lineItems,
      metadata: {
        orderNumber,
        referralCode: referralCode ?? "",
        source: source ?? "",
        utm: utmPayload,
      },
    });

    if (!session.url) {
      throw new Error("Stripe session missing URL");
    }

    logApiSuccess(ctx, 200, {
      orderNumber,
      items: normalizedItems.length,
      email: maskEmail(address?.email),
    });
    return jsonOk({ url: session.url }, ctx);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start checkout";
    logApiError(ctx, 500, error, {
      orderNumber,
      items: normalizedItems.length,
      email: maskEmail(address?.email),
    });
    return jsonError(message, 500, ctx);
  }
}

async function mockCreateOrder(
  items: CheckoutItem[],
  {
    address,
    orderNumber,
    referralCode,
    source,
    utm,
  }: {
    address?: CheckoutPayload["address"];
    orderNumber: string;
    referralCode?: string;
    source?: string;
    utm?: Prisma.InputJsonValue;
  },
) {
  const lookup = new Map(filterMockProducts({ limit: 100 }).map((p) => [p.id, p]));

  const subtotal = items.reduce((sum, item) => {
    const product = lookup.get(item.productId);
    return sum + (product ? Number(product.price) * item.quantity : 0);
  }, 0);
  const shippingTotal = calculateShipping(subtotal);
  const taxTotal = 0;
  const total = subtotal + shippingTotal;

  try {
    const order = await createOrder({
      email: address?.email ?? "guest@example.com",
      subtotal,
      shippingTotal,
      taxTotal,
      total,
      orderNumber,
      shippingAddress: (address ?? {}) as Prisma.InputJsonValue,
      billingAddress: (address ?? {}) as Prisma.InputJsonValue,
      referralCode: referralCode ?? null,
      source: source ?? undefined,
      utm: utm ?? undefined,
      currency: "USD",
      items: items.map((item) => {
        const product = lookup.get(item.productId);
        return {
          productId: item.productId ?? (lookup.keys().next().value as string),
          qty: item.quantity,
          price: product ? Number(product.price) : 0,
          currency: product?.currency ?? "USD",
          titleSnapshot: product?.titleEn,
        };
      }),
      tracking: {
        carrier: "DHL",
        trackingNumber: "MOCK-TRACK",
        statusHistory: [
          {
            timestamp: new Date().toISOString(),
            status: "LABEL_CREATED",
            message: "Order placed",
          },
        ],
      },
    });
    return order;
  } catch (err) {
    console.warn("Mock order creation failed, falling back to in-memory mock.", err);
    return { ...mockOrder, orderNumber };
  }
}
