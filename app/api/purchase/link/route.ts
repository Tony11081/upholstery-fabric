import { prisma } from "@/lib/prisma";
import { safeJson } from "@/lib/utils/stripe";
import { sendEmail } from "@/lib/email";
import { buildPaymentLinkEmail } from "@/lib/email/templates";
import { getSiteUrl } from "@/lib/utils/site";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning, maskEmail } from "@/lib/utils/api";
import { getAdminSession } from "@/lib/auth/admin";

const normalizePaymentLink = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return null;
};

type Body = {
  orderNumber?: string;
  inflywayOrderId?: string;
  paymentLinkUrl?: string;
  paypalInvoiceUrl?: string;
  paymentQrCode?: string;
  note?: string;
};

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  const token = process.env.ADMIN_PAYMENT_LINK_TOKEN;
  if (process.env.NODE_ENV === "production" && !token) {
    logApiError(ctx, 500, new Error("ADMIN_PAYMENT_LINK_TOKEN not configured"));
    return jsonError("ADMIN_PAYMENT_LINK_TOKEN not configured", 500, ctx);
  }

  if (!session) {
    if (token) {
      const header = request.headers.get("x-admin-token");
      if (header !== token) {
        logApiWarning(ctx, 401, { authorized: false });
        return jsonError("Unauthorized", 401, ctx);
      }
    } else {
      logApiWarning(ctx, 401, { authorized: false });
      return jsonError("Unauthorized", 401, ctx);
    }
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx);
  }
  if (!body.orderNumber && !body.inflywayOrderId) {
    logApiWarning(ctx, 400, { missing: "orderNumber_or_inflywayOrderId" });
    return jsonError("orderNumber or inflywayOrderId is required", 400, ctx);
  }
  const resolvedPaymentLinkUrl =
    normalizePaymentLink(body.paymentLinkUrl) ?? normalizePaymentLink(body.paymentQrCode);
  if (!resolvedPaymentLinkUrl && !body.paypalInvoiceUrl) {
    logApiWarning(ctx, 400, { orderNumber: body.orderNumber, missing: "payment_reference" });
    return jsonError("payment_link_url or paypal_invoice_url is required", 400, ctx);
  }

  try {
    const order = await prisma.order.findFirst({
      where: body.orderNumber ? { orderNumber: body.orderNumber } : { inflywayOrderId: body.inflywayOrderId },
      include: { shipments: true },
    });
    if (!order) {
      logApiWarning(ctx, 404, { orderNumber: body.orderNumber, inflywayOrderId: body.inflywayOrderId });
      return jsonError("Order not found", 404, ctx);
    }

    const shipment = order.shipments[0];
    const history = Array.isArray(shipment?.statusHistory) ? shipment?.statusHistory : [];
    const baseMessage = resolvedPaymentLinkUrl ? "Hosted checkout link sent" : "PayPal invoice sent";
    const message = body.note ? `${baseMessage}: ${body.note}` : baseMessage;
    const updatedHistory = [
      ...history,
      {
        timestamp: new Date().toISOString(),
        status: "Payment update",
        message,
      },
    ];

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentLinkUrl: resolvedPaymentLinkUrl ?? order.paymentLinkUrl,
        paypalInvoiceUrl: body.paypalInvoiceUrl ?? order.paypalInvoiceUrl,
        paymentQrCode: resolvedPaymentLinkUrl ? null : order.paymentQrCode,
        inflywayOrderId: body.inflywayOrderId ?? order.inflywayOrderId,
        shipments: shipment
          ? {
              update: {
                where: { id: shipment.id },
                data: { statusHistory: safeJson(updatedHistory) },
              },
            }
          : {
              create: {
                statusHistory: safeJson(updatedHistory),
              },
            },
      },
    });

    if (resolvedPaymentLinkUrl || body.paypalInvoiceUrl) {
      const link = resolvedPaymentLinkUrl ?? body.paypalInvoiceUrl ?? "";
      const siteUrl = getSiteUrl(request.headers.get("origin") ?? undefined);
      const trackUrl = `${siteUrl}/track-order?orderNumber=${order.orderNumber}&email=${encodeURIComponent(order.email)}`;
      const emailTemplate = buildPaymentLinkEmail({
        orderNumber: order.orderNumber,
        paymentUrl: link,
        trackUrl,
      });
      await sendEmail({
        to: order.email,
        subject: emailTemplate.subject,
        text: emailTemplate.text,
        html: emailTemplate.html,
      });
    }

    logApiSuccess(ctx, 200, { orderNumber: order.orderNumber, email: maskEmail(order.email) });
    return jsonOk({ ok: true }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { orderNumber: body.orderNumber });
    return jsonError("Unable to send payment link", 500, ctx);
  }
}
