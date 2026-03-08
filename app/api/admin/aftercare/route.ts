import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/admin";
import {
  createApiContext,
  jsonError,
  jsonOk,
  logApiError,
  logApiSuccess,
  logApiWarning,
} from "@/lib/utils/api";

export async function GET(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.toUpperCase();

  try {
    const cases = await prisma.aftercareCase.findMany({
      where: status ? { status: status as "REQUESTED" | "APPROVED" | "REJECTED" | "REFUNDED" | "EXCHANGED" | "IN_PROGRESS" | "CLOSED" } : undefined,
      orderBy: { createdAt: "desc" },
      include: { order: true, customer: true },
    });

    logApiSuccess(ctx, 200, { count: cases.length });
    return jsonOk(
      {
        cases: cases.map((caseItem) => ({
          id: caseItem.id,
          status: caseItem.status,
          reason: caseItem.reason,
          notes: caseItem.notes,
          createdAt: caseItem.createdAt,
          orderNumber: caseItem.order.orderNumber,
          orderEmail: caseItem.order.email,
          orderTotal: caseItem.order.total,
          customerName: caseItem.customer?.name ?? null,
        })),
      },
      ctx,
    );
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to load aftercare cases", 500, ctx, { code: "AFTERCARE_LOAD_FAILED" });
  }
}

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  let body: { orderNumber?: string; orderId?: string; reason?: string; notes?: string };
  try {
    body = (await request.json()) as { orderNumber?: string; orderId?: string; reason?: string; notes?: string };
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx, { code: "INVALID_BODY" });
  }

  const orderNumber = body.orderNumber?.trim();
  const orderId = body.orderId?.trim();
  if (!orderNumber && !orderId) {
    logApiWarning(ctx, 400, { reason: "missing_order" });
    return jsonError("Order number is required", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  try {
    const order = orderId
      ? await prisma.order.findUnique({ where: { id: orderId } })
      : await prisma.order.findUnique({ where: { orderNumber: orderNumber! } });
    if (!order) {
      logApiWarning(ctx, 404, { reason: "order_not_found" });
      return jsonError("Order not found", 404, ctx, { code: "NOT_FOUND" });
    }

    const aftercareCase = await prisma.aftercareCase.create({
      data: {
        orderId: order.id,
        customerId: order.customerId ?? null,
        status: "REQUESTED",
        reason: body.reason?.trim() || null,
        notes: body.notes?.trim() || null,
      },
    });

    logApiSuccess(ctx, 201, { id: aftercareCase.id });
    return jsonOk({ aftercareCase }, ctx, { status: 201 });
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to create aftercare case", 500, ctx, { code: "AFTERCARE_CREATE_FAILED" });
  }
}
