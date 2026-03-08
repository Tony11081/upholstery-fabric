import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";
import { getAdminSession } from "@/lib/auth/admin";
import { isOpenClawAdminRequest } from "@/lib/auth/openclaw-admin";

export async function GET(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  const openclawAuthorized = isOpenClawAdminRequest(request);
  if (!session && !openclawAuthorized) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") as OrderStatus | null;
  const limit = Number(searchParams.get("limit") ?? "50");
  const offset = Number(searchParams.get("offset") ?? "0");

  const where: Prisma.OrderWhereInput = {};
  if (status) {
    where.status = status;
  }
  if (q) {
    where.OR = [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  try {
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          shipments: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.order.count({ where }),
    ]);

    logApiSuccess(ctx, 200, { total, limit, offset });
    return jsonOk({ orders, total }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to load orders", 500, ctx, { code: "ORDER_FETCH_FAILED" });
  }
}
