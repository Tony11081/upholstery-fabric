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

const VALID_TYPES = ["EDITORIAL", "DROP", "GUIDE", "LOOKBOOK"] as const;
const VALID_STATUSES = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;

type ContentType = (typeof VALID_TYPES)[number];
type ContentStatus = (typeof VALID_STATUSES)[number];

type PatchBody = {
  title?: string;
  slug?: string;
  excerpt?: string;
  body?: string;
  type?: ContentType;
  status?: ContentStatus;
  coverImage?: string;
  publishAt?: string | null;
  productSlugs?: string[] | string;
};

function normalizeList(value: unknown): string[] | null {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
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
  if (body.title) data.title = body.title.trim();
  if (body.slug) data.slug = slugify(body.slug) || body.slug.trim();
  if (body.excerpt !== undefined) data.excerpt = body.excerpt ?? null;
  if (body.body !== undefined) data.body = body.body ?? null;
  if (body.coverImage !== undefined) data.coverImage = body.coverImage ?? null;
  if (body.publishAt !== undefined) {
    data.publishAt = body.publishAt ? new Date(body.publishAt) : null;
  }
  if (body.type && VALID_TYPES.includes(body.type)) data.type = body.type;
  if (body.status && VALID_STATUSES.includes(body.status)) data.status = body.status;

  const productSlugs = normalizeList(body.productSlugs);

  if (Object.keys(data).length === 0 && productSlugs === null) {
    logApiWarning(ctx, 400, { reason: "empty_patch" });
    return jsonError("No changes provided", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  try {
    const content = await prisma.$transaction(async (tx) => {
      const updated = await tx.contentPost.update({
        where: { id },
        data,
      });

      if (productSlugs) {
        const products = productSlugs.length
          ? await tx.product.findMany({
              where: { slug: { in: productSlugs } },
              select: { id: true },
            })
          : [];
        await tx.contentProduct.deleteMany({ where: { contentId: id } });
        if (products.length) {
          await tx.contentProduct.createMany({
            data: products.map((product, index) => ({
              contentId: id,
              productId: product.id,
              sortOrder: index,
            })),
          });
        }
      }

      return updated;
    });

    logApiSuccess(ctx, 200, { id: content.id });
    return jsonOk({ content }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { id });
    return jsonError("Unable to update content", 500, ctx, { code: "CONTENT_UPDATE_FAILED" });
  }
}
