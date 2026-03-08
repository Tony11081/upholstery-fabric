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

  try {
    const requests = await prisma.consultationRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        customer: { select: { name: true, email: true } },
      },
    });
    logApiSuccess(ctx, 200, { count: requests.length });
    return jsonOk({ requests }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to load consultation requests", 500, ctx, { code: "CONSULTATION_FETCH_FAILED" });
  }
}
