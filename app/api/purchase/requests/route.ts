import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";
import { getAdminSession } from "@/lib/auth/admin";

export async function GET(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  const token = process.env.ADMIN_PAYMENT_LINK_TOKEN;
  if (!session) {
    if (token) {
      const header = request.headers.get("x-admin-token");
      if (header !== token) {
        logApiWarning(ctx, 401, { authorized: false });
        return jsonError("Unauthorized", 401, ctx);
      }
    } else {
      logApiWarning(ctx, 401, { authorized: false });
      return jsonError("Unauthorized", 401, ctx);
    }
  }

  try {
    const requests = await prisma.order.findMany({
      where: { status: OrderStatus.AWAITING_PAYMENT_LINK },
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
      },
      take: 100,
    });

    logApiSuccess(ctx, 200, { count: requests.length });
    return jsonOk({ requests }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to load requests", 500, ctx);
  }
}
