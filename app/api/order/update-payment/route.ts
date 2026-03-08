import { prisma } from "@/lib/prisma";
import { isProd } from "@/lib/utils/env";
import { createApiContext, jsonError, jsonOk, logApiSuccess, logApiWarning, maskEmail } from "@/lib/utils/api";

const normalizePaymentLink = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return null;
};

type Body = {
  orderNumber: string;
  email: string;
  paymentLinkUrl?: string;
  inflywayOrderId?: string;
};

const readBearerToken = (authorization?: string | null) => {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  const trimmed = token.trim();
  return trimmed || null;
};

const resolveInternalToken = (request: Request) => {
  const bearer = readBearerToken(request.headers.get("authorization"));
  if (bearer) return bearer;
  const headerToken =
    request.headers.get("x-internal-token") ??
    request.headers.get("x-admin-token") ??
    request.headers.get("x-bot-token");
  const trimmed = headerToken?.trim();
  return trimmed || null;
};

const resolveExpectedToken = () => {
  const dedicatedToken = process.env.ORDER_UPDATE_PAYMENT_TOKEN?.trim();
  if (dedicatedToken) return dedicatedToken;
  const fallbackToken = process.env.ADMIN_PAYMENT_LINK_TOKEN?.trim();
  return fallbackToken || null;
};

export async function POST(request: Request) {
  const ctx = createApiContext(request);

  const expectedToken = resolveExpectedToken();
  if (isProd) {
    if (!expectedToken) {
      logApiWarning(ctx, 410, { reason: "update_payment_disabled_missing_token" });
      return jsonError("Endpoint disabled in production", 410, ctx, { code: "ENDPOINT_DISABLED" });
    }
    const providedToken = resolveInternalToken(request);
    if (!providedToken || providedToken !== expectedToken) {
      logApiWarning(ctx, 401, { reason: "invalid_internal_token" });
      return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
    }
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx);
  }

  if (!body.orderNumber || !body.email) {
    logApiWarning(ctx, 400, { missing: "orderNumber_or_email" });
    return jsonError("orderNumber and email are required", 400, ctx);
  }

  const resolvedPaymentLinkUrl = normalizePaymentLink(body.paymentLinkUrl);
  if (!resolvedPaymentLinkUrl && !body.inflywayOrderId) {
    logApiWarning(ctx, 400, { orderNumber: body.orderNumber, missing: "payment_link_or_inflyway_id" });
    return jsonError("paymentLinkUrl or inflywayOrderId is required", 400, ctx);
  }

  try {
    // 验证订单号和邮箱匹配
    const order = await prisma.order.findFirst({
      where: {
        orderNumber: body.orderNumber,
        email: body.email.toLowerCase(),
      },
    });

    if (!order) {
      logApiWarning(ctx, 404, { orderNumber: body.orderNumber, email: maskEmail(body.email) });
      return jsonError("Order not found or email mismatch", 404, ctx);
    }

    // 更新支付链接
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentLinkUrl: resolvedPaymentLinkUrl ?? order.paymentLinkUrl,
        inflywayOrderId: body.inflywayOrderId ?? order.inflywayOrderId,
        paymentQrCode: resolvedPaymentLinkUrl ? null : order.paymentQrCode,
      },
    });

    logApiSuccess(ctx, 200, { orderNumber: order.orderNumber, email: maskEmail(order.email) });
    return jsonOk({ success: true }, ctx);
  } catch (error) {
    logApiWarning(ctx, 500, { orderNumber: body.orderNumber, error });
    return jsonError("Unable to update payment link", 500, ctx);
  }
}
