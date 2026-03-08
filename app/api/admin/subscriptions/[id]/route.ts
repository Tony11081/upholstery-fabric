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

type PatchBody = {
  active?: boolean;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx, { code: "INVALID_BODY" });
  }

  const { id } = await params;
  if (typeof body.active !== "boolean") {
    logApiWarning(ctx, 400, { reason: "missing_active" });
    return jsonError("Active flag is required", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  try {
    const subscription = await prisma.subscription.update({
      where: { id },
      data: { active: body.active },
    });
    logApiSuccess(ctx, 200, { id: subscription.id, active: subscription.active });
    return jsonOk({ subscription }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { id });
    return jsonError("Unable to update subscription", 500, ctx, { code: "SUBSCRIPTION_UPDATE_FAILED" });
  }
}
