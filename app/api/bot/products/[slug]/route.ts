import { authenticateBotRequest } from "@/lib/auth/bot";
import { getProductBySlug } from "@/lib/data/products";
import { jsonError, jsonOk, logApiError, logApiSuccess } from "@/lib/utils/api";

export const revalidate = 0;

type BotProductDetail = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  price: number;
  discountedPrice?: number;
  discountPercent?: number;
  currency: string;
  inventory: number;
  inStock: boolean;
  isNew: boolean;
  isBestSeller: boolean;
  category: string | null;
  categorySlug: string | null;
  images: string[];
  tags: string[];
  reviewCount: number;
  averageRating: number | null;
};

type RouteParams = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const auth = await authenticateBotRequest(request);
  if (!auth.authorized) {
    return auth.response;
  }

  const { ctx } = auth;
  const { slug } = await params;

  if (!slug) {
    return jsonError("Product slug is required", 400, ctx);
  }

  try {
    const product = await getProductBySlug(slug);

    if (!product) {
      return jsonError("Product not found", 404, ctx, {
        code: "PRODUCT_NOT_FOUND",
      });
    }

    const reviews = product.reviews ?? [];
    const averageRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : null;

    const botProduct: BotProductDetail = {
      id: product.id,
      slug: product.slug,
      title: product.titleEn,
      description: product.descriptionEn,
      price: Number(product.price),
      discountedPrice: product.discountedPrice,
      discountPercent: product.discountPercent,
      currency: product.currency,
      inventory: product.inventory,
      inStock: product.inventory > 0,
      isNew: product.isNew,
      isBestSeller: product.isBestSeller,
      category: product.category?.nameEn ?? null,
      categorySlug: product.category?.slug ?? null,
      images: product.images?.map((img) => img.url) ?? [],
      tags: product.tags,
      reviewCount: reviews.length,
      averageRating,
    };

    logApiSuccess(ctx, 200, { slug, productId: product.id });
    return jsonOk({ product: botProduct }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { slug });
    return jsonError("Unable to load product", 500, ctx);
  }
}
