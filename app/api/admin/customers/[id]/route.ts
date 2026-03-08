import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/admin";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";

type UpdateBody = {
  tags?: string[];
  segment?: string | null;
  preferences?: Prisma.InputJsonValue | null;
  sizes?: Prisma.InputJsonValue | null;
  vipTierId?: string | null;
  points?: number;
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  const { id } = await params;
  try {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        orders: { orderBy: { createdAt: "desc" }, take: 10 },
        notes: { orderBy: { createdAt: "desc" }, take: 20 },
        followUps: { orderBy: { createdAt: "desc" }, take: 20 },
        vipTier: true,
      },
    });
    if (!customer) {
      logApiWarning(ctx, 404, { id });
      return jsonError("Customer not found", 404, ctx, { code: "CUSTOMER_NOT_FOUND" });
    }
    logApiSuccess(ctx, 200, { customerId: id });
    return jsonOk({ customer }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { id });
    return jsonError("Unable to load customer", 500, ctx, { code: "CUSTOMER_FETCH_FAILED" });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  let body: UpdateBody;
  try {
    body = (await request.json()) as UpdateBody;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx, { code: "INVALID_BODY" });
  }

  const { id } = await params;
  try {
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        tags: body.tags ?? undefined,
        segment: body.segment ?? undefined,
        preferences: body.preferences ?? undefined,
        sizes: body.sizes ?? undefined,
        vipTierId: body.vipTierId ?? undefined,
        points: typeof body.points === "number" ? body.points : undefined,
      },
      include: { vipTier: true },
    });
    logApiSuccess(ctx, 200, { customerId: id });
    return jsonOk({ customer }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { id });
    return jsonError("Unable to update customer", 500, ctx, { code: "CUSTOMER_UPDATE_FAILED" });
  }
}
