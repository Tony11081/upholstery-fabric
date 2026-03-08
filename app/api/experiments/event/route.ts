import type { Prisma } from "@prisma/client";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";
import { prisma } from "@/lib/prisma";

type Body = {
  slug?: string;
  event?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx);
  }

  const slug = body.slug?.trim();
  const event = body.event?.trim();
  if (!slug || !event) {
    logApiWarning(ctx, 400, { reason: "missing_fields", slug, event });
    return jsonError("Experiment slug and event are required", 400, ctx);
  }

  try {
    const experiment = await prisma.experiment.findUnique({ where: { slug } });
    if (!experiment) {
      logApiWarning(ctx, 404, { slug });
      return jsonError("Experiment not found", 404, ctx);
    }

    const cookieHeader = request.headers.get("cookie") ?? "";
    const match = cookieHeader.match(/uootd_vid=([^;]+)/);
    const visitorId = match?.[1];

    let variant: string | undefined;
    if (visitorId) {
      const assignment = await prisma.experimentAssignment.findUnique({
        where: { experimentId_visitorId: { experimentId: experiment.id, visitorId } },
      });
      variant = assignment?.variant ?? undefined;
    }

    await prisma.experimentEvent.create({
      data: {
        experimentId: experiment.id,
        visitorId,
        variant,
        event,
        metadata: body.metadata ?? undefined,
      },
    });

    logApiSuccess(ctx, 200, { slug, event });
    return jsonOk({ ok: true }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { slug, event });
    return jsonError("Unable to record experiment event", 500, ctx);
  }
}
