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

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
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

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type")?.toUpperCase() as ContentType | null;

  try {
    const posts = await prisma.contentPost.findMany({
      where: type && VALID_TYPES.includes(type) ? { type } : undefined,
      orderBy: { createdAt: "desc" },
      include: { products: true, reservations: true },
    });

    logApiSuccess(ctx, 200, { count: posts.length });
    return jsonOk(
      {
        posts: posts.map((post) => ({
          id: post.id,
          title: post.title,
          slug: post.slug,
          type: post.type,
          status: post.status,
          coverImage: post.coverImage,
          publishAt: post.publishAt,
          createdAt: post.createdAt,
          productsCount: post.products.length,
          reservationsCount: post.reservations.length,
        })),
      },
      ctx,
    );
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to load content", 500, ctx, { code: "CONTENT_LOAD_FAILED" });
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

  const title = String(body.title ?? "").trim();
  if (!title) {
    logApiWarning(ctx, 400, { reason: "missing_title" });
    return jsonError("Title is required", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  const slug = slugify(String(body.slug ?? "")) || slugify(title);
  const type = (String(body.type ?? "EDITORIAL").toUpperCase() as ContentType) || "EDITORIAL";
  const status = (String(body.status ?? "DRAFT").toUpperCase() as ContentStatus) || "DRAFT";

  if (!slug) {
    logApiWarning(ctx, 400, { reason: "missing_slug" });
    return jsonError("Slug is required", 400, ctx, { code: "VALIDATION_FAILED" });
  }
  if (!VALID_TYPES.includes(type)) {
    logApiWarning(ctx, 400, { reason: "invalid_type", type });
    return jsonError("Invalid content type", 400, ctx, { code: "VALIDATION_FAILED" });
  }
  if (!VALID_STATUSES.includes(status)) {
    logApiWarning(ctx, 400, { reason: "invalid_status", status });
    return jsonError("Invalid content status", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  const productSlugs = normalizeList(body.productSlugs ?? body.products ?? "");
  try {
    const existing = await prisma.contentPost.findUnique({ where: { slug } });
    if (existing) {
      logApiWarning(ctx, 400, { reason: "duplicate_slug", slug });
      return jsonError("Content slug already exists", 400, ctx, { code: "DUPLICATE_SLUG" });
    }

    const products = productSlugs.length
      ? await prisma.product.findMany({
          where: { slug: { in: productSlugs } },
          select: { id: true, slug: true },
        })
      : [];
    const productIds = products.map((product) => product.id);
    const missingSlugs = productSlugs.filter(
      (slugItem) => !products.find((product) => product.slug === slugItem),
    );

    const content = await prisma.contentPost.create({
      data: {
        title,
        slug,
        excerpt: body.excerpt ? String(body.excerpt) : null,
        body: body.body ? String(body.body) : null,
        type,
        status,
        coverImage: body.coverImage ? String(body.coverImage) : null,
        publishAt: body.publishAt ? new Date(String(body.publishAt)) : null,
        products: productIds.length
          ? {
              create: productIds.map((productId, index) => ({
                productId,
                sortOrder: index,
              })),
            }
          : undefined,
      },
    });

    logApiSuccess(ctx, 201, { id: content.id, slug });
    return jsonOk({ content, missingSlugs }, ctx, { status: 201 });
  } catch (error) {
    logApiError(ctx, 500, error, { slug });
    return jsonError("Unable to create content", 500, ctx, { code: "CONTENT_CREATE_FAILED" });
  }
}
