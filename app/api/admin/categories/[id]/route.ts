import { prisma } from "@/lib/prisma";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";
import { getAdminSession } from "@/lib/auth/admin";

type UpdateInput = {
  status?: "ACTIVE" | "PENDING";
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  let body: UpdateInput;
  try {
    body = (await request.json()) as UpdateInput;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx, { code: "INVALID_BODY" });
  }

  if (!body.status) {
    logApiWarning(ctx, 400, { reason: "missing_status" });
    return jsonError("Status is required", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  if (!["ACTIVE", "PENDING"].includes(body.status)) {
    logApiWarning(ctx, 400, { reason: "invalid_status" });
    return jsonError("Status is invalid", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  try {
    const { id } = await params;
    const category = await prisma.category.update({
      where: { id },
      data: { status: body.status },
    });
    logApiSuccess(ctx, 200, { id, status: category.status });
    return jsonOk({ category }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to update category", 500, ctx, { code: "CATEGORY_UPDATE_FAILED" });
  }
}
