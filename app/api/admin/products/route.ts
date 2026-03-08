import { Prisma, ProductQaStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";
import { getAdminSession } from "@/lib/auth/admin";
import { isOpenClawAdminRequest } from "@/lib/auth/openclaw-admin";
import { slugify } from "@/lib/utils/slug";
import { scheduleAutomations } from "@/lib/automation/engine";
import { scoreProductQuality, type QualityImage } from "@/lib/utils/quality";

type ProductInput = {
  titleEn?: string;
  slug?: string;
  descriptionEn?: string;
  categoryId?: string | null;
  price?: number;
  currency?: string;
  inventory?: number;
  tags?: string[] | string;
  isNew?: boolean;
  isBestSeller?: boolean;
  isActive?: boolean;
  qaStatus?: ProductQaStatus;
  qualityNotes?: string | null;
  images?: Array<{ url: string; alt?: string; label?: string; sortOrder?: number; isCover?: boolean }>;
};

async function ensureUniqueSlug(baseSlug: string) {
  let slug = baseSlug;
  let counter = 1;
  while (await prisma.product.findUnique({ where: { slug } })) {
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

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status");
  const qa = searchParams.get("qa");
  const limit = Number(searchParams.get("limit") ?? "50");
  const offset = Number(searchParams.get("offset") ?? "0");

  const where: Prisma.ProductWhereInput = {};
  if (q) {
    where.OR = [
      { titleEn: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
    ];
  }
  if (status === "active") where.isActive = true;
  if (status === "inactive") where.isActive = false;
  if (qa && Object.values(ProductQaStatus).includes(qa as ProductQaStatus)) {
    where.qaStatus = qa as ProductQaStatus;
  }

  try {
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          images: { orderBy: { sortOrder: "asc" } },
          category: true,
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.product.count({ where }),
    ]);

    logApiSuccess(ctx, 200, { q, limit, offset, total });
    return jsonOk({ products, total }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to load products", 500, ctx, { code: "PRODUCTS_FETCH_FAILED" });
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

  let body: ProductInput;
  try {
    body = (await request.json()) as ProductInput;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx, { code: "INVALID_BODY" });
  }

  if (!body.titleEn || typeof body.price !== "number") {
    logApiWarning(ctx, 400, { reason: "missing_fields" });
    return jsonError("Title and price are required", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  const baseSlug = slugify(body.slug ?? body.titleEn);
  if (!baseSlug) {
    return jsonError("Slug is invalid", 400, ctx, { code: "INVALID_SLUG" });
  }

  try {
    const uniqueSlug = await ensureUniqueSlug(baseSlug);
    const tags = Array.isArray(body.tags)
      ? body.tags
      : body.tags
          ?.split(",")
          .map((tag) => tag.trim())
          .filter(Boolean) ?? [];
    const normalizedImages: QualityImage[] = (body.images ?? []).map((image, index) => ({
      url: image.url,
      alt: image.alt ?? body.titleEn,
      label: image.label ?? null,
      isCover: image.isCover ?? index === 0,
    }));
    const quality = scoreProductQuality({
      title: body.titleEn,
      description: body.descriptionEn,
      images: normalizedImages,
    });
    const qualityNotes = body.qualityNotes ?? (quality.notes.length ? quality.notes.join("; ") : null);

    const product = await prisma.product.create({
      data: {
        titleEn: body.titleEn,
        slug: uniqueSlug,
        descriptionEn: body.descriptionEn ?? null,
        categoryId: body.categoryId ?? null,
        price: new Prisma.Decimal(body.price),
        currency: body.currency ?? "USD",
        inventory: body.inventory ?? 0,
        tags,
        isNew: Boolean(body.isNew),
        isBestSeller: Boolean(body.isBestSeller),
        isActive: body.isActive !== false,
        qaStatus: body.qaStatus ?? ProductQaStatus.PENDING,
        qualityScore: quality.score,
        qualityNotes,
        images: body.images?.length
          ? {
              create: body.images.map((image, index) => ({
                url: image.url,
                alt: image.alt ?? body.titleEn,
                label: image.label ?? null,
                sortOrder: image.sortOrder ?? index,
                isCover: image.isCover ?? index === 0,
              })),
            }
          : undefined,
      },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        category: true,
      },
    });

    await prisma.productPriceHistory.create({
      data: {
        productId: product.id,
        price: product.price,
        currency: product.currency,
      },
    });

    if (product.isNew && product.isActive) {
      const subscriptions = await prisma.subscription.findMany({
        where: { type: "NEW_ARRIVAL", active: true },
      });
      await Promise.all(
        subscriptions.map((subscription) =>
          scheduleAutomations("NEW_ARRIVAL", {
            customerId: subscription.customerId,
            email: subscription.email,
            metadata: { productId: product.id, slug: product.slug, title: product.titleEn },
          }),
        ),
      );
    }

    logApiSuccess(ctx, 200, { productId: product.id });
    return jsonOk({ product }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to create product", 500, ctx, { code: "PRODUCT_CREATE_FAILED" });
  }
}
