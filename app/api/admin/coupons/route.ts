import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/admin";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";

type Body = {
  code?: string;
  type?: "PERCENTAGE" | "FIXED_AMOUNT";
  amount?: number;
  maxRedemptions?: number;
  startsAt?: string;
  endsAt?: string;
};

function generateCouponCode() {
  return `UOOTD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function GET(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  try {
    const coupons = await prisma.coupon.findMany({
      include: { assignments: true },
      orderBy: { createdAt: "desc" },
    });
    logApiSuccess(ctx, 200, { count: coupons.length });
    return jsonOk({ coupons }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to load coupons", 500, ctx, { code: "COUPON_FETCH_FAILED" });
  }
}

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx, { code: "INVALID_BODY" });
  }

  if (!body.type || typeof body.amount !== "number") {
    logApiWarning(ctx, 400, { reason: "missing_fields" });
    return jsonError("Type and amount are required", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  try {
    const code = body.code?.trim().toUpperCase() || generateCouponCode();
    const coupon = await prisma.coupon.create({
      data: {
        code,
        type: body.type,
        amount: new Prisma.Decimal(body.amount),
        maxRedemptions: body.maxRedemptions ?? null,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
      },
    });
    logApiSuccess(ctx, 200, { couponId: coupon.id });
    return jsonOk({ coupon }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to create coupon", 500, ctx, { code: "COUPON_CREATE_FAILED" });
  }
}

