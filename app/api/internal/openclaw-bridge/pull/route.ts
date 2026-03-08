import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { authenticateOpenClawBridgeRequest } from "@/lib/auth/openclaw-bridge";
import { jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";

type PullBody = {
  workerId?: string;
};

const STALE_LOCK_MINUTES = 30;

export async function POST(request: Request) {
  const auth = await authenticateOpenClawBridgeRequest(request);
  if (!auth.authorized) return auth.response;
  const ctx = auth.ctx;

  let body: PullBody | null = null;
  try {
    body = (await request.json().catch(() => null)) as PullBody | null;
  } catch {
    body = null;
  }

  try {
    await prisma.aiBridgeJob.updateMany({
      where: {
        status: "IN_PROGRESS",
        lockedAt: {
          lt: new Date(Date.now() - STALE_LOCK_MINUTES * 60 * 1000),
        },
      },
      data: {
        status: "PENDING",
        lockId: null,
        lockedAt: null,
        error: "Recovered stale worker lock",
      },
    });

    const candidate = await prisma.aiBridgeJob.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });

    if (!candidate) {
      logApiSuccess(ctx, 204, { workerId: body?.workerId ?? null, status: "empty" });
      return new Response(null, {
        status: 204,
        headers: {
          "x-request-id": ctx.requestId,
        },
      });
    }

    const lockId = randomUUID();
    const updated = await prisma.aiBridgeJob.updateMany({
      where: { id: candidate.id, status: "PENDING" },
      data: {
        status: "IN_PROGRESS",
        lockId,
        lockedAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      // Rare race: another worker claimed it. Tell this worker to retry.
      logApiWarning(ctx, 204, { workerId: body?.workerId ?? null, status: "race" });
      return new Response(null, {
        status: 204,
        headers: {
          "x-request-id": ctx.requestId,
        },
      });
    }

    logApiSuccess(ctx, 200, {
      workerId: body?.workerId ?? null,
      jobId: candidate.id,
      type: candidate.type,
      attempts: candidate.attempts + 1,
    });

    return jsonOk(
      {
        job: {
          id: candidate.id,
          type: candidate.type,
          lockId,
          attempts: candidate.attempts + 1,
          request: candidate.request,
        },
      },
      ctx,
    );
  } catch (error) {
    logApiError(ctx, 500, error, { workerId: body?.workerId ?? null });
    return jsonError("Unable to pull job", 500, ctx, { code: "PULL_FAILED" });
  }
}
