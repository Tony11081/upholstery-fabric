import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/admin";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";

type Body = {
  title?: string;
  dueAt?: string;
  assignedTo?: string;
  notes?: string;
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const title = body.title?.trim();
  if (!title) {
    logApiWarning(ctx, 400, { reason: "missing_title" });
    return jsonError("Title is required", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  const { id } = await params;
  try {
    const task = await prisma.followUpTask.create({
      data: {
        customerId: id,
        title,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        assignedTo: body.assignedTo?.trim() || session.user?.email || undefined,
        notes: body.notes?.trim() || undefined,
      },
    });
    logApiSuccess(ctx, 200, { followUpId: task.id, customerId: id });
    return jsonOk({ followUp: task }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { customerId: id });
    return jsonError("Unable to create follow-up", 500, ctx, { code: "FOLLOWUP_CREATE_FAILED" });
  }
}

