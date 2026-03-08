import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/admin";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";

type Body = {
  active?: boolean;
  rewardType?: "CREDIT" | "PERCENTAGE" | "FIXED_AMOUNT";
  rewardValue?: number;
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
    const code = await prisma.referralCode.update({
      where: { id },
      data: {
        active: typeof body.active === "boolean" ? body.active : undefined,
        rewardType: body.rewardType ?? undefined,
        rewardValue:
          typeof body.rewardValue === "number" ? new Prisma.Decimal(body.rewardValue) : undefined,
      },
    });
    logApiSuccess(ctx, 200, { codeId: code.id });
    return jsonOk({ code }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { id });
    return jsonError("Unable to update referral", 500, ctx, { code: "REFERRAL_UPDATE_FAILED" });
  }
}
