import { prisma } from "@/lib/prisma";
import { createInventoryAlert } from "@/lib/data/inventory-alerts";
import { recordCustomerEvent, upsertCustomer } from "@/lib/data/customers";
import {
  createApiContext,
  jsonError,
  jsonOk,
  logApiError,
  logApiSuccess,
  logApiWarning,
  maskEmail,
} from "@/lib/utils/api";

type Body = {
  productId?: string;
  email?: string;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx);
  }

  const productId = body.productId?.trim();
  const email = body.email?.trim().toLowerCase();
  if (!productId || !email) {
    logApiWarning(ctx, 400, { reason: "missing_fields", productId });
    return jsonError("Product and email are required", 400, ctx);
  }
  if (!isValidEmail(email)) {
    logApiWarning(ctx, 400, { reason: "invalid_email", email: maskEmail(email) });
    return jsonError("Enter a valid email address", 400, ctx);
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, titleEn: true, inventory: true, isActive: true },
    });
    if (!product || !product.isActive) {
      logApiWarning(ctx, 404, { productId });
      return jsonError("Product not found", 404, ctx);
    }
    if (product.inventory > 0) {
      logApiWarning(ctx, 409, { productId, inventory: product.inventory });
      return jsonError("This item is already in stock", 409, ctx);
    }

    await createInventoryAlert({ productId, email });
    const { customer } = await upsertCustomer({ email });
    const existing = await prisma.subscription.findFirst({
      where: {
        email,
        productId,
        type: "BACK_IN_STOCK",
      },
    });
    if (!existing) {
      await prisma.subscription.create({
        data: {
          email,
          customerId: customer.id,
          productId,
          type: "BACK_IN_STOCK",
        },
      });
    }
    await recordCustomerEvent({
      customerId: customer.id,
      email,
      event: "back_in_stock_subscribe",
      source: "pdp",
      metadata: { productId },
    });

    logApiSuccess(ctx, 200, { productId, email: maskEmail(email) });
    return jsonOk({ subscribed: true }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { productId, email: maskEmail(email) });
    return jsonError("Unable to subscribe", 500, ctx);
  }
}
