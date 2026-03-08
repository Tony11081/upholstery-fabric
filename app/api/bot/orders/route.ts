import { OrderStatus, type Prisma, type Product } from "@prisma/client";
import { authenticateBotRequest } from "@/lib/auth/bot";
import { createOrder } from "@/lib/data/orders";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/utils/site";
import { calculateShipping } from "@/lib/utils/shipping";
import {
  applyDiscount,
  getActiveDiscounts,
  resolveDiscountPercent,
} from "@/lib/utils/discounts";
import { createInflywayOrder } from "@/lib/inflyway/client";
import { buildInflywayOrderNote } from "@/lib/inflyway/order-note";
import {
  jsonError,
  jsonOk,
  logApiError,
  logApiSuccess,
  logApiWarning,
  maskEmail,
} from "@/lib/utils/api";

type OrderItem = {
  productId: string;
  quantity: number;
};

type ShippingAddress = {
  fullName: string;
  email: string;
  phone?: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
};

type CreateOrderPayload = {
  items: OrderItem[];
  address: ShippingAddress;
  shipping?: {
    method?: string;
    price?: number;
  };
  source?: string;
  referralCode?: string;
  idempotencyKey?: string;
};

const PAYMENT_LINK_WAIT_MS = 8000;
const PAYMENT_LINK_POLL_MS = 800;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForPaymentLink(orderId: string) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < PAYMENT_LINK_WAIT_MS) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true, paymentLinkUrl: true, inflywayOrderId: true },
    });
    if (order?.paymentLinkUrl) {
      return order;
    }
    await sleep(PAYMENT_LINK_POLL_MS);
  }
  return null;
}

export async function POST(request: Request) {
  const auth = await authenticateBotRequest(request);
  if (!auth.authorized) {
    return auth.response;
  }

  const { ctx } = auth;

  let body: CreateOrderPayload;
  try {
    body = (await request.json()) as CreateOrderPayload;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx);
  }

  const { items, address, shipping, source, referralCode } = body;
  const headerIdempotencyKey =
    request.headers.get("x-idempotency-key") ||
    request.headers.get("idempotency-key");
  const idempotencyKey = body.idempotencyKey?.trim() || headerIdempotencyKey?.trim() || null;

  // Validate items
  if (!Array.isArray(items) || items.length === 0) {
    logApiWarning(ctx, 400, { reason: "empty_items" });
    return jsonError("Items are required", 400, ctx);
  }

  // Validate address
  if (!address?.email || !address?.fullName || !address?.address1) {
    logApiWarning(ctx, 400, { reason: "invalid_address" });
    return jsonError(
      "Address with email, fullName, and address1 is required",
      400,
      ctx,
    );
  }

  const normalizedItems: OrderItem[] = items
    .map((item) => ({
      productId: item?.productId ?? "",
      quantity: Number(item?.quantity) || 1,
    }))
    .filter((item) => !!item.productId);

  if (normalizedItems.length === 0) {
    logApiWarning(ctx, 400, { reason: "missing_products" });
    return jsonError("Valid product IDs are required", 400, ctx);
  }

  try {
    if (idempotencyKey) {
      const existingOrder = await prisma.order.findUnique({
        where: { idempotencyKey },
      });
      if (existingOrder?.paymentLinkUrl) {
        const siteUrl = getSiteUrl(request.headers.get("origin") ?? undefined);
        return jsonOk(
          {
            orderNumber: existingOrder.orderNumber,
            total: Number(existingOrder.total),
            currency: existingOrder.currency,
            paymentLinkUrl: existingOrder.paymentLinkUrl,
            inflywayOrderId: existingOrder.inflywayOrderId ?? undefined,
            trackUrl: `${siteUrl}/track-order?orderNumber=${existingOrder.orderNumber}&email=${encodeURIComponent(existingOrder.email)}`,
          },
          ctx,
        );
      }
      if (existingOrder?.status === OrderStatus.PROCESSING) {
        const waited = await waitForPaymentLink(existingOrder.id);
        if (waited?.paymentLinkUrl) {
          const siteUrl = getSiteUrl(request.headers.get("origin") ?? undefined);
          return jsonOk(
            {
              orderNumber: waited.orderNumber,
              total: Number(existingOrder.total),
              currency: existingOrder.currency,
              paymentLinkUrl: waited.paymentLinkUrl,
              inflywayOrderId: waited.inflywayOrderId ?? undefined,
              trackUrl: `${siteUrl}/track-order?orderNumber=${waited.orderNumber}&email=${encodeURIComponent(existingOrder.email)}`,
              status: "success",
            },
            ctx,
          );
        }
        return jsonOk(
          { orderNumber: existingOrder.orderNumber, status: "processing" },
          ctx,
        );
      }
    }

    const uniqueProductIds = Array.from(
      new Set(normalizedItems.map((item) => item.productId)),
    );

    const dbProducts: (Product & { images: { url: string }[] })[] =
      await prisma.product.findMany({
        where: { id: { in: uniqueProductIds }, isActive: true },
        include: { images: { take: 1, orderBy: { sortOrder: "asc" } } },
      });

    if (dbProducts.length !== uniqueProductIds.length) {
      const foundIds = new Set(dbProducts.map((p) => p.id));
      const missingIds = uniqueProductIds.filter((id) => !foundIds.has(id));
      logApiWarning(ctx, 400, { reason: "product_unavailable", missingIds });
      return jsonError("One or more products are unavailable", 400, ctx, {
        code: "PRODUCT_UNAVAILABLE",
        missingIds,
      });
    }

    // Check inventory
    for (const item of normalizedItems) {
      const product = dbProducts.find((p) => p.id === item.productId);
      if (product && product.inventory < item.quantity) {
        logApiWarning(ctx, 400, {
          reason: "insufficient_inventory",
          productId: item.productId,
          requested: item.quantity,
          available: product.inventory,
        });
        return jsonError(
          `Insufficient inventory for product: ${product.titleEn}`,
          400,
          ctx,
          {
            code: "INSUFFICIENT_INVENTORY",
            productId: item.productId,
            requested: item.quantity,
            available: product.inventory,
          },
        );
      }
    }

    const discounts = await getActiveDiscounts();
    let subtotal = 0;
    const orderItems = normalizedItems.map((item) => {
      const product = dbProducts.find((p) => p.id === item.productId)!;
      const discountPercent = resolveDiscountPercent(
        product.id,
        product.categoryId,
        discounts,
      );
      const unitPrice = applyDiscount(Number(product.price), discountPercent);
      subtotal += unitPrice * item.quantity;

      return {
        productId: item.productId,
        qty: item.quantity,
        price: unitPrice,
        currency: product.currency || "USD",
        titleSnapshot: product.titleEn,
      };
    });

    const shippingTotal = shipping?.price ?? calculateShipping(subtotal);
    const taxTotal = 0;
    const total = subtotal + shippingTotal + taxTotal;
    const order = await createOrder({
      email: address.email.trim().toLowerCase(),
      mode: "request",
      status: OrderStatus.AWAITING_PAYMENT_LINK,
      subtotal,
      shippingTotal,
      taxTotal,
      total,
      currency: "USD",
      shippingAddress: address as unknown as Prisma.InputJsonValue,
      billingAddress: address as unknown as Prisma.InputJsonValue,
      idempotencyKey,
      source: source ?? "bot",
      referralCode: referralCode ?? null,
      items: orderItems,
    });

    const noteItems = orderItems.map((item) => ({
      title: item.titleSnapshot ?? "Item",
      quantity: item.qty,
    }));
    const orderNote = buildInflywayOrderNote({
      orderNumber: order.orderNumber,
      email: address.email,
      name: address.fullName,
      phone: address.phone,
      items: noteItems,
      total,
      currency: "USD",
      address,
    });

    const inflywayResult = await createInflywayOrder({
      amount: total,
      currency: "USD",
      traceId: ctx.requestId,
      orderNote,
      shippingInfo: {
        fullName: address.fullName,
        email: address.email,
        phone: address.phone,
        country: address.country,
        state: address.state,
        city: address.city,
        postalCode: address.postalCode,
        address1: address.address1,
        address2: address.address2,
      },
    });

    if (!inflywayResult.success || !inflywayResult.orderUrl) {
      logApiError(ctx, 500, new Error(inflywayResult.error || "Inflyway failed"), {
        email: maskEmail(address.email),
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

    logApiSuccess(ctx, 201, {
      orderNumber: updatedOrder.orderNumber,
      email: maskEmail(address.email),
      itemCount: normalizedItems.length,
      total,
    });

    return jsonOk(
      {
        orderNumber: updatedOrder.orderNumber,
        total,
        currency: "USD",
        paymentLinkUrl: inflywayResult.orderUrl,
        inflywayOrderId: inflywayResult.orderId,
        trackUrl: `${siteUrl}/track-order?orderNumber=${updatedOrder.orderNumber}&email=${encodeURIComponent(address.email)}`,
      },
      ctx,
      { status: 201 },
    );
  } catch (error) {
    logApiError(ctx, 500, error, {
      email: maskEmail(address.email),
      itemCount: normalizedItems.length,
    });
    return jsonError("Unable to create order", 500, ctx);
  }
}
