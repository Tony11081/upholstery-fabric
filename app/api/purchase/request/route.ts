import { OrderStatus, Prisma } from "@prisma/client";
import { createOrder } from "@/lib/data/orders";
import { prisma } from "@/lib/prisma";
import { isInvoiceMode, isProd } from "@/lib/utils/env";
import { generateRequestNumber, safeJson } from "@/lib/utils/stripe";
import { sendEmail } from "@/lib/email";
import { buildRequestReceivedEmail } from "@/lib/email/templates";
import { getSiteUrl } from "@/lib/utils/site";
import { calculateShipping } from "@/lib/utils/shipping";
import {
  createApiContext,
  jsonError,
  jsonOk,
  logApiError,
  logApiSuccess,
  logApiWarning,
  maskEmail,
} from "@/lib/utils/api";
import { applyDiscount, getActiveDiscounts, resolveDiscountPercent } from "@/lib/utils/discounts";
import { createInflywayOrder } from "@/lib/inflyway/client";
import { buildInflywayOrderNote } from "@/lib/inflyway/order-note";

type RequestBody = {
  items: Array<{
    productId: string;
    quantity: number;
    options?: Record<string, string>;
  }>;
  email: string;
  cardholderName: string;
  billingCountry: string;
  referralCode?: string;
  utm?: Prisma.InputJsonValue;
  billingAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    postalCode?: string;
    region?: string;
  };
};

const OPTION_LABELS: Record<string, string> = {
  color: "Color",
  size: "Size",
};

const formatOptions = (options?: Record<string, string>) => {
  if (!options) return "";
  const entries = Object.entries(options).filter(([, value]) => value);
  if (!entries.length) return "";
  return entries
    .map(([key, value]) => `${OPTION_LABELS[key] ?? key}: ${value}`)
    .join(", ");
};

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  if (isProd) {
    logApiWarning(ctx, 410, { reason: "legacy_checkout_disabled" });
    return jsonError("Legacy checkout endpoint disabled", 410, ctx);
  }

  if (!isInvoiceMode) {
    logApiWarning(ctx, 400, { reason: "invoice_mode_disabled" });
    return jsonError("Invoice mode disabled", 400, ctx);
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx);
  }

  if (!body?.items?.length) {
    logApiWarning(ctx, 400, { reason: "empty_bag" });
    return jsonError("Bag is empty", 400, ctx);
  }
  if (!body.email || !body.cardholderName || !body.billingCountry) {
    logApiWarning(ctx, 400, { reason: "missing_fields", email: maskEmail(body.email) });
    return jsonError("Email, cardholder name, and billing country are required", 400, ctx);
  }

  try {
    const uniqueProductIds = Array.from(new Set(body.items.map((item) => item.productId)));
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: uniqueProductIds } },
      include: { images: true },
    });
    const discounts = await getActiveDiscounts();

    if (dbProducts.length !== uniqueProductIds.length) {
      logApiWarning(ctx, 400, { reason: "product_unavailable", count: dbProducts.length });
      return jsonError("One or more products are unavailable", 400, ctx);
    }

    let discountTotal = 0;
    const subtotal = body.items.reduce((sum, item) => {
      const product = dbProducts.find((p) => p.id === item.productId);
      if (!product) return sum;
      const discountPercent = resolveDiscountPercent(product.id, product.categoryId, discounts);
      const originalPrice = Number(product.price);
      const unitPrice = applyDiscount(originalPrice, discountPercent);
      if (discountPercent > 0) {
        discountTotal += (originalPrice - unitPrice) * (item.quantity || 1);
      }
      return sum + unitPrice * (item.quantity || 1);
    }, 0);

    const shippingTotal = calculateShipping(subtotal);
    const total = subtotal + shippingTotal;

    const orderNumber = generateRequestNumber();
    const addressJson = safeJson({
      fullName: body.cardholderName,
      country: body.billingCountry,
      ...body.billingAddress,
    });

    const order = await createOrder({
      email: body.email.toLowerCase(),
      mode: "request",
      orderNumber,
      status: OrderStatus.AWAITING_PAYMENT_LINK,
      subtotal,
      shippingTotal,
      taxTotal: 0,
      total,
      discountTotal,
      currency: "USD",
      paymentMethod: "invoice",
      source: "invoice",
      referralCode: body.referralCode ?? null,
      utm: body.utm ?? undefined,
      shippingAddress: addressJson,
      billingAddress: addressJson,
      items: body.items.map((item) => {
        const product = dbProducts.find((p) => p.id === item.productId)!;
        const discountPercent = resolveDiscountPercent(product.id, product.categoryId, discounts);
        const unitPrice = applyDiscount(Number(product.price), discountPercent);
        const optionText = formatOptions(item.options);
        return {
          productId: product.id,
          qty: item.quantity || 1,
          price: unitPrice,
          currency: product.currency,
          titleSnapshot: optionText ? `${product.titleEn} (${optionText})` : product.titleEn,
        };
      }),
      tracking: {
        statusHistory: [
          {
            timestamp: new Date().toISOString(),
            status: "Request received",
            message: "We have received your purchase request.",
          },
        ],
      },
    });

    const noteItems = body.items.map((item) => {
      const product = dbProducts.find((p) => p.id === item.productId);
      const optionText = formatOptions(item.options);
      const title = product
        ? optionText
          ? `${product.titleEn} (${optionText})`
          : product.titleEn
        : optionText
          ? `Item (${optionText})`
          : "Item";
      return { title, quantity: item.quantity || 1 };
    });
    const orderNote = buildInflywayOrderNote({
      orderNumber: order.orderNumber,
      email: body.email,
      name: body.cardholderName,
      items: noteItems,
      total,
      currency: "USD",
      address: {
        email: body.email,
        fullName: body.cardholderName,
        country: body.billingCountry,
        address1: body.billingAddress?.line1,
        address2: body.billingAddress?.line2,
        city: body.billingAddress?.city,
        state: body.billingAddress?.region,
        postalCode: body.billingAddress?.postalCode,
      },
    });

    const inflywayResult = await createInflywayOrder({
      amount: total,
      currency: "USD",
      traceId: ctx.requestId,
      orderNote,
      shippingInfo: {
        fullName: body.cardholderName,
        email: body.email,
        country: body.billingCountry,
        state: body.billingAddress?.region,
        city: body.billingAddress?.city,
        postalCode: body.billingAddress?.postalCode,
        address1: body.billingAddress?.line1,
        address2: body.billingAddress?.line2,
      },
    });

    if (!inflywayResult.success || !inflywayResult.orderUrl) {
      logApiError(ctx, 500, new Error(inflywayResult.error || "Inflyway failed"), {
        email: maskEmail(body.email),
        orderNumber: order.orderNumber,
        inflywayOrderId: inflywayResult.orderId,
        hasPaymentLink: Boolean(inflywayResult.orderUrl),
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.AWAITING_PAYMENT_LINK },
      });
      return jsonError(inflywayResult.error || "Unable to create payment link", 500, ctx);
    }

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentLinkUrl: inflywayResult.orderUrl,
        inflywayOrderId: inflywayResult.orderId ?? order.inflywayOrderId,
        status: OrderStatus.PENDING,
      },
    });

    const siteUrl = getSiteUrl(request.headers.get("origin") ?? undefined);
    const trackUrl = `${siteUrl}/track-order?orderNumber=${updatedOrder.orderNumber}&email=${encodeURIComponent(updatedOrder.email)}`;
    const emailItems = order.items.map((item) => ({
      title: item.titleSnapshot ?? "Item",
      qty: item.qty,
      price: Number(item.price),
      currency: item.currency,
    }));
    const emailTemplate = buildRequestReceivedEmail({
      orderNumber: updatedOrder.orderNumber,
      email: updatedOrder.email,
      items: emailItems,
      trackUrl,
    });

    try {
      await sendEmail({
        to: body.email,
        subject: emailTemplate.subject,
        text: emailTemplate.text,
        html: emailTemplate.html,
      });
    } catch (emailError) {
      console.warn("[purchase/request] Email send failed:", emailError);
    }

    logApiSuccess(ctx, 200, {
      orderNumber: updatedOrder.orderNumber,
      email: maskEmail(updatedOrder.email),
      items: body.items.length,
    });
    return jsonOk(
      {
        orderNumber: updatedOrder.orderNumber,
        paymentLinkUrl: inflywayResult.orderUrl,
        inflywayOrderId: inflywayResult.orderId,
      },
      ctx
    );
  } catch (error) {
    logApiError(ctx, 500, error, { email: maskEmail(body.email), items: body.items?.length ?? 0 });
    return jsonError("Unable to submit request", 500, ctx);
  }
}
