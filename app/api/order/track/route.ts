import { getOrderByNumberAndEmail } from "@/lib/data/orders";
import { mockOrder } from "@/lib/data/mock-orders";
import { isProd } from "@/lib/utils/env";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning, maskEmail } from "@/lib/utils/api";

export const revalidate = 0;

const ADMIN_ORDER_PATH_PATTERNS = [
  /\/#\/kn\/fly-link\/orders/i,
  /\/kamelnet\/#\/kn\/fly-link\/orders/i,
  /\/fly-link\/orders(?:\/add)?/i,
];

function normalizePublicCheckoutLink(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : /^www\./i.test(trimmed)
      ? `https://${trimmed}`
      : null;
  if (!normalized) return null;

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return null;
  }

  if (/inflyway\.com$/i.test(parsed.hostname)) {
    const pathAndHash = `${parsed.pathname}${parsed.hash}`.toLowerCase();
    if (ADMIN_ORDER_PATH_PATTERNS.some((pattern) => pattern.test(pathAndHash))) {
      return null;
    }
  }

  return normalized;
}

function sanitizeTrackedOrder<T extends { paymentLinkUrl?: string | null; paypalInvoiceUrl?: string | null; paymentQrCode?: string | null }>(
  order: T,
) {
  const paymentLinkUrl = normalizePublicCheckoutLink(order.paymentLinkUrl);
  const paypalInvoiceUrl = normalizePublicCheckoutLink(order.paypalInvoiceUrl);
  const rawQr = order.paymentQrCode?.trim();
  const qrLooksLikeLink = Boolean(rawQr && (/^https?:\/\//i.test(rawQr) || /^www\./i.test(rawQr)));
  const paymentQrCode = qrLooksLikeLink
    ? normalizePublicCheckoutLink(rawQr) ?? null
    : order.paymentQrCode;

  return {
    ...order,
    paymentLinkUrl,
    paypalInvoiceUrl,
    paymentQrCode,
  };
}

async function lookup(ctx: ReturnType<typeof createApiContext>, orderNumber?: string | null, email?: string | null) {
  if (!orderNumber || !email) {
    logApiWarning(ctx, 400, { orderNumber, email: maskEmail(email) });
    return jsonError("Order number and email are required", 400, ctx);
  }

  try {
    const order = await getOrderByNumberAndEmail(orderNumber, email);
    if (!order) {
      if (
        !isProd &&
        orderNumber === mockOrder.orderNumber &&
        email.trim().toLowerCase() === mockOrder.email.toLowerCase()
      ) {
        logApiWarning(ctx, 200, { orderNumber, email: maskEmail(email), fallback: "mock" });
        return jsonOk({ found: true, order: mockOrder }, ctx);
      }
      logApiWarning(ctx, 404, { orderNumber, email: maskEmail(email) });
      return jsonError("Order not found", 404, ctx);
    }

    const sanitizedOrder = sanitizeTrackedOrder(order);
    logApiSuccess(ctx, 200, { orderNumber, email: maskEmail(email) });
    return jsonOk({ found: true, order: sanitizedOrder }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { orderNumber, email: maskEmail(email) });
    return jsonError("Unable to look up order", 500, ctx);
  }
}

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  try {
    const body = await request.json();
    return lookup(ctx, body?.orderNumber, body?.email);
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx);
  }
}

export async function GET(request: Request) {
  const ctx = createApiContext(request);
  const { searchParams } = new URL(request.url);
  return lookup(ctx, searchParams.get("orderNumber"), searchParams.get("email"));
}
