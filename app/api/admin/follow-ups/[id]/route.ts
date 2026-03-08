import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/admin";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";

type Body = {
  status?: "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELED";
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

  if (!body.status) {
    logApiWarning(ctx, 400, { reason: "missing_status" });
    return jsonError("Status is required", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  const { id } = await params;
  try {
    const followUp = await prisma.followUpTask.update({
      where: { id },
      data: { status: body.status },
    });
    logApiSuccess(ctx, 200, { followUpId: followUp.id, status: followUp.status });
    return jsonOk({ followUp }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { id });
    return jsonError("Unable to update follow-up", 500, ctx, { code: "FOLLOWUP_UPDATE_FAILED" });
  }
}

