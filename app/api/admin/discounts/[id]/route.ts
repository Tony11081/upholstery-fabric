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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;

  try {
    const discount = await prisma.discount.update({
      where: { id },
      data: {
        name: body.name,
        scope: body.scope,
        percentage: typeof body.percentage === "number" ? body.percentage : undefined,
        active: body.active,
        startsAt: body.startsAt ? new Date(body.startsAt) : body.startsAt === null ? null : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt) : body.endsAt === null ? null : undefined,
        productId: body.scope === "PRODUCT" ? body.productId ?? null : body.scope ? null : undefined,
        categoryId: body.scope === "CATEGORY" ? body.categoryId ?? null : body.scope ? null : undefined,
      },
      include: { product: true, category: true },
    });
    logApiSuccess(ctx, 200, { discountId: discount.id });
    return jsonOk({ discount }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { id });
    return jsonError("Unable to update discount", 500, ctx, { code: "DISCOUNT_UPDATE_FAILED" });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  const { id } = await params;

  try {
    await prisma.discount.delete({ where: { id } });
    logApiSuccess(ctx, 200, { discountId: id });
    return jsonOk({ deleted: true }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { id });
    return jsonError("Unable to delete discount", 500, ctx, { code: "DISCOUNT_DELETE_FAILED" });
  }
}
