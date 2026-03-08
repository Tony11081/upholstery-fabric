import { Prisma, ProductQaStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";
import { getAdminSession } from "@/lib/auth/admin";
import { isOpenClawAdminRequest } from "@/lib/auth/openclaw-admin";
import { slugify } from "@/lib/utils/slug";
import { notifyBackInStock } from "@/lib/data/inventory-alerts";
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

const adminProductSelect = {
  id: true,
  titleEn: true,
  slug: true,
  descriptionEn: true,
  categoryId: true,
  price: true,
  currency: true,
  inventory: true,
  tags: true,
  isNew: true,
  isBestSeller: true,
  isActive: true,
  qaStatus: true,
  qualityScore: true,
  qualityNotes: true,
  createdAt: true,
  updatedAt: true,
  images: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      url: true,
      alt: true,
      label: true,
      sortOrder: true,
      isCover: true,
      productId: true,
    },
  },
  category: {
    select: {
      id: true,
      nameEn: true,
      slug: true,
    },
  },
} satisfies Prisma.ProductSelect;

function normalizeTags(tags?: string[] | string) {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags.map((tag) => tag.trim()).filter(Boolean);
  }
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

async function ensureUniqueSlug(baseSlug: string, currentId: string) {
  let slug = baseSlug;
  let counter = 1;
  while (true) {
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (!existing || existing.id === currentId) {
      return slug;
    }
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  const openclawAuthorized = isOpenClawAdminRequest(request);
  if (!session && !openclawAuthorized) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  const { id } = await params;

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      select: adminProductSelect,
    });
    if (!product) {
      logApiWarning(ctx, 404, { id });
      return jsonError("Product not found", 404, ctx, { code: "PRODUCT_NOT_FOUND" });
    }
    logApiSuccess(ctx, 200, { productId: product.id });
    return jsonOk({ product }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { id });
    return jsonError("Unable to load product", 500, ctx, { code: "PRODUCT_FETCH_FAILED" });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  const openclawAuthorized = isOpenClawAdminRequest(request);
  if (!session && !openclawAuthorized) {
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

  const { id } = await params;

  try {
    const existing = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        titleEn: true,
        slug: true,
        descriptionEn: true,
        categoryId: true,
        price: true,
        currency: true,
        inventory: true,
        tags: true,
        isNew: true,
        isBestSeller: true,
        isActive: true,
        qaStatus: true,
        images: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            url: true,
            alt: true,
            label: true,
            sortOrder: true,
            isCover: true,
          },
        },
      },
    });
    if (!existing) {
      logApiWarning(ctx, 404, { id });
      return jsonError("Product not found", 404, ctx, { code: "PRODUCT_NOT_FOUND" });
    }
    const previousInventory = existing.inventory;
    const previousPrice = Number(existing.price);

    const baseSlug = body.slug ? slugify(body.slug) : body.titleEn ? slugify(body.titleEn) : existing.slug;
    const slug = baseSlug ? await ensureUniqueSlug(baseSlug, id) : existing.slug;
    const tags = normalizeTags(body.tags);
    const nextTitle = body.titleEn ?? existing.titleEn;
    const nextDescription = body.descriptionEn ?? existing.descriptionEn;
    const normalizedImages: QualityImage[] = body.images
      ? body.images.map((image, index) => ({
          url: image.url,
          alt: image.alt ?? nextTitle,
          label: image.label ?? null,
          isCover: image.isCover ?? index === 0,
        }))
      : existing.images.map((image) => ({
          url: image.url,
          alt: image.alt ?? nextTitle,
          label: image.label ?? null,
          isCover: image.isCover,
        }));
    const quality = scoreProductQuality({
      title: nextTitle,
      description: nextDescription ?? undefined,
      images: normalizedImages,
    });
    const qualityNotes = body.qualityNotes ?? (quality.notes.length ? quality.notes.join("; ") : null);

    const product = await prisma.product.update({
      where: { id },
      data: {
        titleEn: nextTitle,
        slug,
        descriptionEn: nextDescription,
        categoryId: body.categoryId === "" ? null : body.categoryId ?? existing.categoryId,
        price:
          typeof body.price === "number"
            ? new Prisma.Decimal(body.price)
            : existing.price,
        currency: body.currency ?? existing.currency,
        inventory: typeof body.inventory === "number" ? body.inventory : existing.inventory,
        tags: tags.length ? tags : existing.tags,
        isNew: typeof body.isNew === "boolean" ? body.isNew : existing.isNew,
        isBestSeller: typeof body.isBestSeller === "boolean" ? body.isBestSeller : existing.isBestSeller,
        isActive: typeof body.isActive === "boolean" ? body.isActive : existing.isActive,
        qaStatus: body.qaStatus ?? existing.qaStatus,
        qualityScore: quality.score,
        qualityNotes,
        images: body.images
          ? {
              deleteMany: {},
              create: body.images.map((image, index) => ({
                url: image.url,
                alt: image.alt ?? nextTitle,
                label: image.label ?? null,
                sortOrder: image.sortOrder ?? index,
                isCover: image.isCover ?? index === 0,
              })),
            }
          : undefined,
      },
      select: adminProductSelect,
    });

    const nextPrice = Number(product.price);
    if (previousPrice !== nextPrice) {
      await prisma.productPriceHistory.create({
        data: {
          productId: product.id,
          price: product.price,
          currency: product.currency,
        },
      });
    }

    if (previousInventory <= 0 && product.inventory > 0) {
      await notifyBackInStock({
        id: product.id,
        slug: product.slug,
        titleEn: product.titleEn,
      });

      const subscriptions = await prisma.subscription.findMany({
        where: { type: "BACK_IN_STOCK", productId: product.id, active: true },
      });
      await Promise.all(
        subscriptions.map((subscription) =>
          scheduleAutomations("BACK_IN_STOCK", {
            customerId: subscription.customerId,
            email: subscription.email,
            metadata: { productId: product.id, slug: product.slug, title: product.titleEn },
          }),
        ),
      );
    }

    if (previousPrice > nextPrice) {
      const subscriptions = await prisma.subscription.findMany({
        where: { type: "PRICE_DROP", productId: product.id, active: true },
      });
      await Promise.all(
        subscriptions.map((subscription) =>
          scheduleAutomations("PRICE_DROP", {
            customerId: subscription.customerId,
            email: subscription.email,
            metadata: { productId: product.id, slug: product.slug, title: product.titleEn, price: nextPrice },
          }),
        ),
      );
    }

    logApiSuccess(ctx, 200, { productId: product.id });
    return jsonOk({ product }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { id });
    return jsonError("Unable to update product", 500, ctx, { code: "PRODUCT_UPDATE_FAILED" });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;

  try {
    await prisma.product.delete({ where: { id } });
    logApiSuccess(ctx, 200, { productId: id });
    return jsonOk({ deleted: true }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { id });
    return jsonError("Unable to delete product", 500, ctx, { code: "PRODUCT_DELETE_FAILED" });
  }
}
