import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/admin";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";

type Body = {
  note?: string;
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

  const note = body.note?.trim();
  if (!note) {
    logApiWarning(ctx, 400, { reason: "missing_note" });
    return jsonError("Note is required", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  const { id } = await params;
  try {
    const created = await prisma.customerNote.create({
      data: {
        customerId: id,
        note,
        author: session.user?.email ?? undefined,
      },
    });
    logApiSuccess(ctx, 200, { noteId: created.id, customerId: id });
    return jsonOk({ note: created }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { customerId: id });
    return jsonError("Unable to create note", 500, ctx, { code: "NOTE_CREATE_FAILED" });
  }
}

