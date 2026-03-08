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
  const type = searchParams.get("type")?.toUpperCase();
  const activeParam = searchParams.get("active");
  const active = activeParam === "true" ? true : activeParam === "false" ? false : undefined;

  try {
    const subscriptions = await prisma.subscription.findMany({
      where: {
        type: type ? (type as "BACK_IN_STOCK" | "PRICE_DROP" | "NEW_ARRIVAL") : undefined,
        active,
      },
      orderBy: { createdAt: "desc" },
      include: { product: true, category: true, customer: true },
    });

    logApiSuccess(ctx, 200, { count: subscriptions.length });
    return jsonOk(
      {
        subscriptions: subscriptions.map((subscription) => ({
          id: subscription.id,
          type: subscription.type,
          email: subscription.email,
          active: subscription.active,
          createdAt: subscription.createdAt,
          product: subscription.product
            ? { id: subscription.product.id, titleEn: subscription.product.titleEn, slug: subscription.product.slug }
            : null,
          category: subscription.category
            ? { id: subscription.category.id, nameEn: subscription.category.nameEn, slug: subscription.category.slug }
            : null,
          customerId: subscription.customerId,
        })),
      },
      ctx,
    );
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to load subscriptions", 500, ctx, { code: "SUBSCRIPTIONS_FAILED" });
  }
}
