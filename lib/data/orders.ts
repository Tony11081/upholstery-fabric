import { OrderStatus, Prisma, TrackingStatus } from "@prisma/client";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/prisma";
import { mockOrder } from "@/lib/data/mock-orders";
import { isProd } from "@/lib/utils/env";
import { generateOrderNumber, generateRequestNumber } from "@/lib/utils/stripe";
import { applyOrderToCustomer, recordCustomerEvent, upsertCustomer } from "@/lib/data/customers";
import { scheduleAutomations } from "@/lib/automation/engine";
import { attachReferralToOrder } from "@/lib/referral";

export const orderItemProductSelect = {
  id: true,
  slug: true,
  titleEn: true,
  price: true,
  currency: true,
  category: {
    select: {
      id: true,
      nameEn: true,
      slug: true,
    },
  },
  images: {
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      url: true,
      alt: true,
      sortOrder: true,
      isCover: true,
      productId: true,
    },
  },
} satisfies Prisma.ProductSelect;

export const orderWithRelationsInclude = {
  items: {
    include: {
      product: {
        select: orderItemProductSelect,
      },
    },
  },
  shipments: true,
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof orderWithRelationsInclude;
}>;

export async function getOrderByNumberAndEmail(
  orderNumber: string,
  email: string,
): Promise<OrderWithRelations | null> {
  noStore();

  try {
    return await prisma.order.findFirst({
      where: {
        orderNumber,
        email: email.trim().toLowerCase(),
      },
      include: {
        ...orderWithRelationsInclude,
        shipments: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
  } catch (error) {
    if (!isProd && orderNumber === mockOrder.orderNumber && email.trim().toLowerCase() === mockOrder.email.toLowerCase()) {
      return mockOrder as unknown as OrderWithRelations;
    }
    if (isProd) {
      throw error;
    }
    return null;
  }
}

type OrderItemInput = {
  productId: string;
  qty: number;
  price: number;
  currency: string;
  titleSnapshot?: string;
};

export async function createOrder(payload: {
  email: string;
  userId?: string;
  orderNumber?: string;
  mode?: "order" | "request";
  stripeSessionId?: string;
  status?: OrderStatus;
  subtotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  discountTotal?: number;
  currency?: string;
  shippingAddress: Prisma.InputJsonValue;
  billingAddress?: Prisma.InputJsonValue;
  paymentMethod?: string;
  paymentLinkUrl?: string | null;
  paypalInvoiceUrl?: string | null;
  inflywayOrderId?: string | null;
  idempotencyKey?: string | null;
  source?: string;
  utm?: Prisma.InputJsonValue;
  couponCode?: string | null;
  referralCode?: string | null;
  items: OrderItemInput[];
  tracking?: {
    carrier?: string;
    trackingNumber?: string;
    status?: TrackingStatus;
    statusHistory?: Array<{ timestamp: string; status: TrackingStatus | string; message: string }>;
    eta?: Date;
  };
}): Promise<OrderWithRelations> {
  noStore();
  const toDecimal = (value: number) => new Prisma.Decimal(value);
  const orderNumber =
    payload.orderNumber ??
    (payload.mode === "request" ? generateRequestNumber() : generateOrderNumber());

  const shipping = payload.shippingAddress as Record<string, unknown>;
  const shippingName = typeof shipping?.fullName === "string" ? shipping.fullName : undefined;
  const shippingPhone = typeof shipping?.phone === "string" ? shipping.phone : undefined;
  const { customer, created } = await upsertCustomer({
    email: payload.email,
    name: shippingName,
    phone: shippingPhone,
    source: payload.source ?? null,
    utm: payload.utm ?? undefined,
  });

  const order = (await prisma.order.create({
    data: {
      orderNumber,
      email: payload.email.trim().toLowerCase(),
      status: payload.status ?? OrderStatus.CONFIRMED,
      subtotal: toDecimal(payload.subtotal),
      shippingTotal: toDecimal(payload.shippingTotal),
      taxTotal: toDecimal(payload.taxTotal),
      total: toDecimal(payload.total),
      discountTotal: toDecimal(payload.discountTotal ?? 0),
      currency: payload.currency ?? "USD",
      stripeSessionId: payload.stripeSessionId,
      shippingAddress: payload.shippingAddress,
      billingAddress: payload.billingAddress,
      paymentMethod: payload.paymentMethod,
      paymentLinkUrl: payload.paymentLinkUrl ?? null,
      paypalInvoiceUrl: payload.paypalInvoiceUrl ?? null,
      inflywayOrderId: payload.inflywayOrderId ?? null,
      idempotencyKey: payload.idempotencyKey ?? null,
      source: payload.source ?? null,
      utm: payload.utm ?? undefined,
      couponCode: payload.couponCode ?? null,
      userId: payload.userId,
      customerId: customer.id,
      items: {
        create: payload.items.map((item) => ({
          productId: item.productId,
          qty: item.qty,
          price: toDecimal(item.price),
          currency: item.currency,
          titleSnapshot: item.titleSnapshot,
        })),
      },
      shipments: payload.tracking
        ? {
            create: {
              carrier: payload.tracking.carrier,
              trackingNumber: payload.tracking.trackingNumber,
              status: payload.tracking.status ?? TrackingStatus.LABEL_CREATED,
              statusHistory: payload.tracking.statusHistory ?? [],
              estimatedDelivery: payload.tracking.eta,
            },
          }
        : undefined,
    },
    include: orderWithRelationsInclude,
  })) as OrderWithRelations;

  try {
    if (payload.referralCode) {
      await attachReferralToOrder({
        referralCode: payload.referralCode,
        orderId: order.id,
        referredCustomerId: customer.id,
        referredEmail: order.email,
      });
    }
    await recordCustomerEvent({
      customerId: customer.id,
      email: payload.email,
      event: payload.mode === "request" ? "purchase_request" : "order_created",
      source: payload.source ?? "checkout",
      metadata: { orderNumber, total: payload.total },
    });

    if (created) {
      await scheduleAutomations("WELCOME", { customerId: customer.id, email: customer.email });
    }

    const paidStatuses: OrderStatus[] = [
      OrderStatus.CONFIRMED,
      OrderStatus.PROCESSING,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ];
    if (paidStatuses.includes(order.status)) {
      await applyOrderToCustomer({ customerId: customer.id, orderTotal: payload.total });
      await scheduleAutomations("POST_PURCHASE", { customerId: customer.id, email: customer.email });
    }
  } catch (error) {
    console.error("Customer automation update failed", error);
  }

  return order;
}
