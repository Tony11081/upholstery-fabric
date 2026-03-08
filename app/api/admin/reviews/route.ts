import { ReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/admin";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";

export async function GET(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status")?.toUpperCase();
  const status =
    statusParam && Object.values(ReviewStatus).includes(statusParam as ReviewStatus)
      ? (statusParam as ReviewStatus)
      : undefined;

  try {
    const reviews = await prisma.review.findMany({
      where: status ? { status } : undefined,
      include: { product: true, customer: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    logApiSuccess(ctx, 200, { count: reviews.length });
    return jsonOk({ reviews }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to load reviews", 500, ctx, { code: "REVIEWS_FETCH_FAILED" });
  }
}
