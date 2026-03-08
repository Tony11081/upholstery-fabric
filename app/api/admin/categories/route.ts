import { prisma } from "@/lib/prisma";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";
import { getAdminSession } from "@/lib/auth/admin";
import { isOpenClawAdminRequest } from "@/lib/auth/openclaw-admin";
import { slugify } from "@/lib/utils/slug";

type CategoryInput = {
  nameEn?: string;
  slug?: string;
  parentId?: string | null;
};

async function ensureUniqueSlug(baseSlug: string) {
  let slug = baseSlug;
  let counter = 1;
  while (await prisma.category.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
  return slug;
}

export async function GET(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  const openclawAuthorized = isOpenClawAdminRequest(request);
  if (!session && !openclawAuthorized) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  try {
    const categories = await prisma.category.findMany({
      include: { children: true },
      orderBy: [{ parentId: "asc" }, { nameEn: "asc" }],
    });
    logApiSuccess(ctx, 200, { count: categories.length });
    return jsonOk({ categories }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to load categories", 500, ctx, { code: "CATEGORY_FETCH_FAILED" });
  }
}

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  const openclawAuthorized = isOpenClawAdminRequest(request);
  if (!session) {
    if (openclawAuthorized) {
      logApiWarning(ctx, 403, { authorized: false, reason: "openclaw_readonly" });
      return jsonError("Forbidden", 403, ctx, { code: "FORBIDDEN" });
    }
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  let body: CategoryInput;
  try {
    body = (await request.json()) as CategoryInput;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx, { code: "INVALID_BODY" });
  }

  if (!body.nameEn) {
    logApiWarning(ctx, 400, { reason: "missing_name" });
    return jsonError("Category name is required", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  const baseSlug = slugify(body.slug ?? body.nameEn);
  if (!baseSlug) {
    return jsonError("Slug is invalid", 400, ctx, { code: "INVALID_SLUG" });
  }

  try {
    const uniqueSlug = await ensureUniqueSlug(baseSlug);
    const category = await prisma.category.create({
      data: {
        nameEn: body.nameEn,
        slug: uniqueSlug,
        parentId: body.parentId ?? null,
        status: "ACTIVE",
      },
    });
    logApiSuccess(ctx, 200, { categoryId: category.id });
    return jsonOk({ category }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to create category", 500, ctx, { code: "CATEGORY_CREATE_FAILED" });
  }
}
