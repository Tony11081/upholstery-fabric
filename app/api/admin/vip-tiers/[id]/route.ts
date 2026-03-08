import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/admin";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";

type Body = {
  name?: string;
  level?: number;
  minSpend?: number;
  pointsPerDollar?: number;
  birthdayGift?: string | null;
  earlyAccessDays?: number;
  supportChannel?: string | null;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;
  try {
    const data: Prisma.VipTierUpdateInput = {
      name: body.name ?? undefined,
      level: typeof body.level === "number" ? body.level : undefined,
      minSpend: typeof body.minSpend === "number" ? new Prisma.Decimal(body.minSpend) : undefined,
      pointsPerDollar:
        typeof body.pointsPerDollar === "number" ? new Prisma.Decimal(body.pointsPerDollar) : undefined,
      birthdayGift: body.birthdayGift ?? undefined,
      earlyAccessDays: typeof body.earlyAccessDays === "number" ? body.earlyAccessDays : undefined,
      supportChannel: body.supportChannel ?? undefined,
    };

    const tier = await prisma.vipTier.update({ where: { id }, data });
    logApiSuccess(ctx, 200, { tierId: tier.id });
    return jsonOk({ tier }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { id });
    return jsonError("Unable to update VIP tier", 500, ctx, { code: "VIP_UPDATE_FAILED" });
  }
}
