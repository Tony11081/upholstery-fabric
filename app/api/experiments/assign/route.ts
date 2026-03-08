import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";

function pickVariant(variants: unknown[]): string {
  const normalized = variants.filter(Boolean);
  if (!normalized.length) return "control";

  if (typeof normalized[0] === "string") {
    const items = normalized as string[];
    return items[Math.floor(Math.random() * items.length)];
  }

  const weighted = normalized as Array<{ name?: string; weight?: number }>;
  const total = weighted.reduce((sum, item) => sum + (item.weight ?? 1), 0);
  let pick = Math.random() * (total || 1);
  for (const item of weighted) {
    pick -= item.weight ?? 1;
    if (pick <= 0) {
      return item.name ?? "control";
    }
  }
  return weighted[0]?.name ?? "control";
}

export async function GET(request: Request) {
  const ctx = createApiContext(request);
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug")?.trim();

  if (!slug) {
    logApiWarning(ctx, 400, { reason: "missing_slug" });
    return jsonError("Experiment slug is required", 400, ctx);
  }

  try {
    const experiment = await prisma.experiment.findUnique({ where: { slug } });
    if (!experiment || experiment.status !== "RUNNING") {
      logApiWarning(ctx, 200, { slug, status: experiment?.status ?? "missing" });
      return jsonOk({ variant: "control", active: false }, ctx);
    }

    const cookieHeader = request.headers.get("cookie") ?? "";
    const match = cookieHeader.match(/uootd_vid=([^;]+)/);
    const visitorId = match?.[1] ?? randomUUID();

    const existing = await prisma.experimentAssignment.findUnique({
      where: { experimentId_visitorId: { experimentId: experiment.id, visitorId } },
    });

    let variant = existing?.variant ?? "";
    if (!variant) {
      const variants = Array.isArray(experiment.variants) ? experiment.variants : [];
      variant = pickVariant(variants);
      await prisma.experimentAssignment.create({
        data: {
          experimentId: experiment.id,
          visitorId,
          variant,
        },
      });
    }

    const response = jsonOk({ variant, active: true }, ctx);
    response.headers.append(
      "Set-Cookie",
      `uootd_vid=${visitorId}; Path=/; Max-Age=31536000; SameSite=Lax`,
    );
    logApiSuccess(ctx, 200, { slug, variant });
    return response;
  } catch (error) {
    logApiError(ctx, 500, error, { slug });
    return jsonError("Unable to assign experiment", 500, ctx);
  }
}
