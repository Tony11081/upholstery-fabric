import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authenticateOpenClawBridgeRequest } from "@/lib/auth/openclaw-bridge";
import { jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";

type Body = {
  id?: string;
  lockId?: string;
  ok?: boolean;
  response?: unknown;
  error?: string;
};

export async function POST(request: Request) {
  const auth = await authenticateOpenClawBridgeRequest(request);
  if (!auth.authorized) return auth.response;
  const ctx = auth.ctx;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx, { code: "INVALID_BODY" });
  }

  if (!body.id || !body.lockId) {
    logApiWarning(ctx, 400, { reason: "missing_id_or_lockId" });
    return jsonError("id and lockId are required", 400, ctx, { code: "MISSING_FIELDS" });
  }

  const ok = body.ok === true;
  const errorMessage = ok ? null : (body.error ?? "Unknown worker error");

  try {
    const updated = await prisma.aiBridgeJob.updateMany({
      where: { id: body.id, lockId: body.lockId, status: "IN_PROGRESS" },
      data: {
        status: ok ? "DONE" : "FAILED",
        response: ok ? (body.response as Prisma.InputJsonValue) : undefined,
        error: errorMessage,
        lockId: null,
        lockedAt: null,
      },
    });

    if (updated.count === 0) {
      logApiWarning(ctx, 409, { id: body.id, ok, status: "stale_lock" });
      return jsonError("Job not found or lock expired", 409, ctx, { code: "STALE_LOCK" });
    }

    logApiSuccess(ctx, 200, { id: body.id, ok });
    return jsonOk({ ok: true }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { id: body.id, ok });
    return jsonError("Unable to complete job", 500, ctx, { code: "COMPLETE_FAILED" });
  }
}
