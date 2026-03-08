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

type PatchBody = {
  name?: string;
  slug?: string;
  status?: "DRAFT" | "RUNNING" | "PAUSED" | "COMPLETED";
  variants?: unknown;
  startAt?: string;
  endAt?: string;
};

function normalizeVariants(value: unknown): unknown[] | null {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = createApiContext(request);
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

  const { id } = await params;
  const data: Record<string, unknown> = {};
  if (body.name) data.name = body.name.trim();
  if (body.slug) data.slug = slugify(body.slug) || body.slug.trim();
  if (body.status) data.status = body.status;

  const variants = normalizeVariants(body.variants);
  if (variants) {
    data.variants = variants;
  }

  if (body.startAt !== undefined) {
    data.startAt = body.startAt ? new Date(body.startAt) : null;
  }
  if (body.endAt !== undefined) {
    data.endAt = body.endAt ? new Date(body.endAt) : null;
  }

  if (Object.keys(data).length === 0) {
    logApiWarning(ctx, 400, { reason: "empty_patch" });
    return jsonError("No changes provided", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  try {
    const experiment = await prisma.experiment.update({
      where: { id },
      data,
    });
    logApiSuccess(ctx, 200, { id: experiment.id });
    return jsonOk({ experiment }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { id });
    return jsonError("Unable to update experiment", 500, ctx, { code: "EXPERIMENT_UPDATE_FAILED" });
  }
}
