import { OrderStatus, Prisma, TrackingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { buildOrderStatusEmail } from "@/lib/email/templates";
import { getSiteUrl } from "@/lib/utils/site";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";
import { getAdminSession } from "@/lib/auth/admin";
import { applyOrderToCustomer, recordCustomerEvent } from "@/lib/data/customers";
import { scheduleAutomations } from "@/lib/automation/engine";
import { orderWithRelationsInclude } from "@/lib/data/orders";

type UpdateInput = {
  status?: OrderStatus;
  trackingNumber?: string;
  carrier?: string;
  paymentLinkUrl?: string | null;
  paypalInvoiceUrl?: string | null;
  note?: string;
};

const statusMessages: Record<OrderStatus, string> = {
  PENDING: "Order pending",
  CONFIRMED: "Payment confirmed",
  AWAITING_PAYMENT_LINK: "Request received",
  PROCESSING: "Order processing",
  SHIPPED: "Order shipped",
  DELIVERED: "Order delivered",
  CANCELED: "Order canceled",
  RETURNED: "Order returned",
};

function normalizeHistory(history: unknown) {
  return Array.isArray(history) ? history : [];
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  const { id } = await params;

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: orderWithRelationsInclude,
    });
    if (!order) {
      logApiWarning(ctx, 404, { id });
      return jsonError("Order not found", 404, ctx, { code: "ORDER_NOT_FOUND" });
    }
    logApiSuccess(ctx, 200, { orderId: order.id });
    return jsonOk({ order }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { id });
    return jsonError("Unable to load order", 500, ctx, { code: "ORDER_FETCH_FAILED" });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  let body: UpdateInput;
  try {
    body = (await request.json()) as UpdateInput;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx, { code: "INVALID_BODY" });
  }

  const { id } = await params;

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { shipments: true },
    });
    if (!order) {
      logApiWarning(ctx, 404, { id });
      return jsonError("Order not found", 404, ctx, { code: "ORDER_NOT_FOUND" });
    }

    const shipment = order.shipments[0];
    const history = normalizeHistory(shipment?.statusHistory);
    const updatedHistory = [...history];
    if (body.status) {
      updatedHistory.push({
        timestamp: new Date().toISOString(),
        status: body.status,
        message: statusMessages[body.status] ?? "Status updated",
      });
    }
    if (body.note) {
      updatedHistory.push({
        timestamp: new Date().toISOString(),
        status: "NOTE",
        message: body.note,
      });
    }

    const updateData: Prisma.OrderUpdateInput = {
      status: body.status ?? order.status,
      paymentLinkUrl: body.paymentLinkUrl ?? order.paymentLinkUrl,
      paypalInvoiceUrl: body.paypalInvoiceUrl ?? order.paypalInvoiceUrl,
    };

    const nextTrackingStatus =
      body.status === "DELIVERED"
        ? TrackingStatus.DELIVERED
        : body.status === "SHIPPED"
          ? TrackingStatus.IN_TRANSIT
          : shipment?.status ?? TrackingStatus.LABEL_CREATED;

    const shipmentUpdate =
      body.trackingNumber || body.carrier || body.status || body.note
        ? shipment
          ? {
              update: {
                where: { id: shipment.id },
                data: {
                  trackingNumber: body.trackingNumber ?? shipment.trackingNumber,
                  carrier: body.carrier ?? shipment.carrier,
                  status: nextTrackingStatus,
                  statusHistory: updatedHistory,
                },
              },
            }
          : {
              create: {
                trackingNumber: body.trackingNumber ?? null,
                carrier: body.carrier ?? null,
                status: nextTrackingStatus,
                statusHistory: updatedHistory,
              },
            }
        : undefined;

    const updated = await prisma.order.update({
      where: { id },
      data: {
        ...updateData,
        shipments: shipmentUpdate,
      },
      include: { items: true, shipments: true },
    });

    const statusChanged = body.status && body.status !== order.status;
    if (statusChanged && updated.customerId) {
      try {
        await recordCustomerEvent({
          customerId: updated.customerId,
          email: updated.email,
          event: `order_status_${body.status?.toLowerCase()}`,
          source: "admin",
          metadata: { orderNumber: updated.orderNumber },
        });

        const paidStatuses: OrderStatus[] = [
          OrderStatus.CONFIRMED,
          OrderStatus.PROCESSING,
          OrderStatus.SHIPPED,
          OrderStatus.DELIVERED,
        ];
        if (!paidStatuses.includes(order.status) && paidStatuses.includes(updated.status)) {
          await applyOrderToCustomer({
            customerId: updated.customerId,
            orderTotal: Number(updated.total),
          });
          await scheduleAutomations("POST_PURCHASE", {
            customerId: updated.customerId,
            email: updated.email,
            metadata: { orderNumber: updated.orderNumber },
          });
        }
      } catch (eventError) {
        logApiError(ctx, 500, eventError, { orderId: updated.id, reason: "customer_update_failed" });
      }
    }

    const statusForEmail = body.status;
    if (
      statusForEmail &&
      statusForEmail !== order.status &&
      (statusForEmail === "CONFIRMED" || statusForEmail === "SHIPPED" || statusForEmail === "DELIVERED")
    ) {
      const trackUrl = `${getSiteUrl(request.headers.get("origin") ?? undefined)}/track-order?orderNumber=${updated.orderNumber}&email=${encodeURIComponent(updated.email)}`;
      const emailTemplate = buildOrderStatusEmail({
        orderNumber: updated.orderNumber,
        status: statusForEmail,
        items: updated.items.map((item) => ({
          title: item.titleSnapshot ?? "Item",
          qty: item.qty,
          price: Number(item.price),
          currency: item.currency,
        })),
        trackUrl,
        trackingNumber: updated.shipments[0]?.trackingNumber,
        carrier: updated.shipments[0]?.carrier,
      });
      try {
        await sendEmail({
          to: updated.email,
          subject: emailTemplate.subject,
          text: emailTemplate.text,
          html: emailTemplate.html,
        });
      } catch (emailError) {
        logApiError(ctx, 500, emailError, { orderId: updated.id, reason: "status_email_failed" });
      }
    }

    logApiSuccess(ctx, 200, { orderId: updated.id });
    return jsonOk({ order: updated }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { id });
    return jsonError("Unable to update order", 500, ctx, { code: "ORDER_UPDATE_FAILED" });
  }
}
