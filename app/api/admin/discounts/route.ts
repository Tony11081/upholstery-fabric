import { DiscountScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";
import { getAdminSession } from "@/lib/auth/admin";

type DiscountInput = {
  name?: string;
  scope?: DiscountScope;
  percentage?: number;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  productId?: string | null;
  categoryId?: string | null;
};

export async function GET(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  try {
    const discounts = await prisma.discount.findMany({
      include: {
        product: true,
        category: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    logApiSuccess(ctx, 200, { count: discounts.length });
    return jsonOk({ discounts }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to load discounts", 500, ctx, { code: "DISCOUNT_FETCH_FAILED" });
  }
}

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  let body: DiscountInput;
  try {
    body = (await request.json()) as DiscountInput;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx, { code: "INVALID_BODY" });
  }

  if (!body.name || typeof body.percentage !== "number" || !body.scope) {
    logApiWarning(ctx, 400, { reason: "missing_fields" });
    return jsonError("Name, scope, and percentage are required", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  try {
    const discount = await prisma.discount.create({
      data: {
        name: body.name,
        scope: body.scope,
        percentage: body.percentage,
        active: body.active ?? false,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        productId: body.scope === "PRODUCT" ? body.productId ?? null : null,
        categoryId: body.scope === "CATEGORY" ? body.categoryId ?? null : null,
      },
      include: {
        product: true,
        category: true,
      },
    });

    logApiSuccess(ctx, 200, { discountId: discount.id });
    return jsonOk({ discount }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to create discount", 500, ctx, { code: "DISCOUNT_CREATE_FAILED" });
  }
}
