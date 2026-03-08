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
  status?: "REQUESTED" | "APPROVED" | "REJECTED" | "REFUNDED" | "EXCHANGED" | "IN_PROGRESS" | "CLOSED";
  notes?: string;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = createApiContext(request);
  const { id } = await params;
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

  const data: Record<string, unknown> = {};
  if (body.status) data.status = body.status;
  if (body.notes !== undefined) data.notes = body.notes || null;

  if (Object.keys(data).length === 0) {
    logApiWarning(ctx, 400, { reason: "empty_patch" });
    return jsonError("No changes provided", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  try {
    const aftercareCase = await prisma.aftercareCase.update({
      where: { id },
      data,
    });
    logApiSuccess(ctx, 200, { id: aftercareCase.id });
    return jsonOk({ aftercareCase }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { id });
    return jsonError("Unable to update aftercare case", 500, ctx, { code: "AFTERCARE_UPDATE_FAILED" });
  }
}
