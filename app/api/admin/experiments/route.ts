import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/admin";
import { slugify } from "@/lib/utils/slug";
import {
  createApiContext,
  jsonError,
  jsonOk,
  logApiError,
  logApiSuccess,
  logApiWarning,
} from "@/lib/utils/api";

function normalizeVariants(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export async function GET(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  try {
    const experiments = await prisma.experiment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { assignments: true, events: true },
        },
      },
    });

    logApiSuccess(ctx, 200, { count: experiments.length });
    return jsonOk(
      {
        experiments: experiments.map((experiment) => ({
          id: experiment.id,
          name: experiment.name,
          slug: experiment.slug,
          status: experiment.status,
          variants: experiment.variants,
          startAt: experiment.startAt,
          endAt: experiment.endAt,
          assignments: experiment._count.assignments,
          events: experiment._count.events,
        })),
      },
      ctx,
    );
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to load experiments", 500, ctx, { code: "EXPERIMENTS_FAILED" });
  }
}

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx, { code: "INVALID_BODY" });
  }

  const name = String(body.name ?? "").trim();
  if (!name) {
    logApiWarning(ctx, 400, { reason: "missing_name" });
    return jsonError("Experiment name is required", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  const slug = slugify(String(body.slug ?? "")) || slugify(name);
  if (!slug) {
    logApiWarning(ctx, 400, { reason: "missing_slug" });
    return jsonError("Experiment slug is required", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  const variants = normalizeVariants(body.variants);
  if (!variants.length) {
    logApiWarning(ctx, 400, { reason: "missing_variants" });
    return jsonError("At least one variant is required", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  try {
    const existing = await prisma.experiment.findUnique({ where: { slug } });
    if (existing) {
      logApiWarning(ctx, 400, { reason: "duplicate_slug", slug });
      return jsonError("Experiment slug already exists", 400, ctx, { code: "DUPLICATE_SLUG" });
    }

    const experiment = await prisma.experiment.create({
      data: {
        name,
        slug,
        status: (body.status as "DRAFT" | "RUNNING" | "PAUSED" | "COMPLETED") ?? "DRAFT",
        variants,
        startAt: body.startAt ? new Date(String(body.startAt)) : null,
        endAt: body.endAt ? new Date(String(body.endAt)) : null,
      },
    });

    logApiSuccess(ctx, 201, { id: experiment.id, slug });
    return jsonOk({ experiment }, ctx, { status: 201 });
  } catch (error) {
    logApiError(ctx, 500, error, { slug });
    return jsonError("Unable to create experiment", 500, ctx, { code: "EXPERIMENT_CREATE_FAILED" });
  }
}
