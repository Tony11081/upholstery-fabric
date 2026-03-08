import { prisma } from "@/lib/prisma";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning, maskEmail } from "@/lib/utils/api";
import { upsertCustomer } from "@/lib/data/customers";

type Body = {
  type?: "BACK_IN_STOCK" | "PRICE_DROP" | "NEW_ARRIVAL";
  email?: string;
  productId?: string;
  categoryId?: string;
};

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx);
  }

  const email = body.email?.trim().toLowerCase();
  const type = body.type;
  if (!email || !type) {
    logApiWarning(ctx, 400, { reason: "missing_fields" });
    return jsonError("Email and subscription type are required", 400, ctx);
  }

  try {
    const { customer } = await upsertCustomer({ email });
    const existing = await prisma.subscription.findFirst({
      where: {
        email,
        type,
        productId: body.productId ?? undefined,
        categoryId: body.categoryId ?? undefined,
      },
    });
    if (!existing) {
      await prisma.subscription.create({
        data: {
          email,
          customerId: customer.id,
          type,
          productId: body.productId ?? undefined,
          categoryId: body.categoryId ?? undefined,
        },
      });
    }

    logApiSuccess(ctx, 200, { email: maskEmail(email), type });
    return jsonOk({ subscribed: true }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { email: maskEmail(email), type });
    return jsonError("Unable to subscribe", 500, ctx);
  }
}

