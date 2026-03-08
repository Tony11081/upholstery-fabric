import { authenticateBotRequest } from "@/lib/auth/bot";
import { getOrderByNumberAndEmail } from "@/lib/data/orders";
import { getSiteUrl } from "@/lib/utils/site";
import {
  jsonError,
  jsonOk,
  logApiError,
  logApiSuccess,
  logApiWarning,
  maskEmail,
} from "@/lib/utils/api";

export const revalidate = 0;

type BotOrderItem = {
  productId: string;
  title: string;
  quantity: number;
  price: number;
  currency: string;
  image: string | null;
};

type BotShipment = {
  carrier: string | null;
  trackingNumber: string | null;
  status: string;
  estimatedDelivery: string | null;
};

type BotOrder = {
  orderNumber: string;
  status: string;
  email: string;
  subtotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  currency: string;
  paymentLinkUrl: string | null;
  paypalInvoiceUrl: string | null;
  trackUrl: string;
  items: BotOrderItem[];
  shipments: BotShipment[];
  createdAt: string;
  updatedAt: string;
};

type RouteParams = {
  params: Promise<{ number: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const auth = await authenticateBotRequest(request);
  if (!auth.authorized) {
    return auth.response;
  }

  const { ctx } = auth;
  const { number: orderNumber } = await params;
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!orderNumber) {
    return jsonError("Order number is required", 400, ctx);
  }

  if (!email) {
    logApiWarning(ctx, 400, { orderNumber, reason: "missing_email" });
    return jsonError("Email is required", 400, ctx, {
      code: "MISSING_EMAIL",
    });
  }

  try {
    const order = await getOrderByNumberAndEmail(orderNumber, email);

    if (!order) {
      logApiWarning(ctx, 404, { orderNumber, email: maskEmail(email) });
      return jsonError("Order not found", 404, ctx, {
        code: "ORDER_NOT_FOUND",
      });
    }

    const siteUrl = getSiteUrl(request.headers.get("origin") ?? undefined);

    const botOrder: BotOrder = {
      orderNumber: order.orderNumber,
      status: order.status,
      email: order.email,
      subtotal: Number(order.subtotal),
      shippingTotal: Number(order.shippingTotal),
      taxTotal: Number(order.taxTotal),
      total: Number(order.total),
      currency: order.currency,
      paymentLinkUrl: order.paymentLinkUrl,
      paypalInvoiceUrl: order.paypalInvoiceUrl,
      trackUrl: `${siteUrl}/track-order?orderNumber=${order.orderNumber}&email=${encodeURIComponent(order.email)}`,
      items: order.items.map((item) => ({
        productId: item.productId,
        title: item.titleSnapshot ?? item.product?.titleEn ?? "Unknown",
        quantity: item.qty,
        price: Number(item.price),
        currency: item.currency,
        image: item.product?.images?.[0]?.url ?? null,
      })),
      shipments: order.shipments.map((shipment) => ({
        carrier: shipment.carrier,
        trackingNumber: shipment.trackingNumber,
        status: shipment.status,
        estimatedDelivery: shipment.estimatedDelivery?.toISOString() ?? null,
      })),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };

    logApiSuccess(ctx, 200, { orderNumber, email: maskEmail(email) });
    return jsonOk({ order: botOrder }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { orderNumber, email: maskEmail(email) });
    return jsonError("Unable to look up order", 500, ctx);
  }
}
