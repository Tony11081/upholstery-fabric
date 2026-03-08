import { authenticateBotRequest } from "@/lib/auth/bot";
import {
  getProducts,
  searchProducts,
  type ProductSort,
} from "@/lib/data/products";
import { jsonError, jsonOk, logApiError, logApiSuccess } from "@/lib/utils/api";

export const revalidate = 0;

type BotProduct = {
  id: string;
  slug: string;
  title: string;
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
  image: string | null;
  tags: string[];
};

export async function GET(request: Request) {
  const auth = await authenticateBotRequest(request);
  if (!auth.authorized) {
    return auth.response;
  }

  const { ctx } = auth;
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const category = searchParams.get("category");
  const limit = Math.min(Number(searchParams.get("limit") ?? "12"), 50);
  const page = Number(searchParams.get("page") ?? "0");
  const offset = Number.isFinite(page) && page > 0 ? page * limit : 0;
  const sort = (searchParams.get("sort") as ProductSort | null) ?? null;
  const tag = searchParams.get("tag");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const availability = searchParams.get("availability");

  try {
    const products = q
      ? await searchProducts(q, { limit, offset })
      : await getProducts({
          category,
          limit,
          offset,
          sort,
          tag,
          minPrice: minPrice ? Number(minPrice) : null,
          maxPrice: maxPrice ? Number(maxPrice) : null,
          availability: availability === "in_stock" ? "in_stock" : null,
        });

    const botProducts: BotProduct[] = products.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.titleEn,
      price: Number(p.price),
      discountedPrice: p.discountedPrice,
      discountPercent: p.discountPercent,
      currency: p.currency,
      inventory: p.inventory,
      inStock: p.inventory > 0,
      isNew: p.isNew,
      isBestSeller: p.isBestSeller,
      category: p.category?.nameEn ?? null,
      categorySlug: p.category?.slug ?? null,
      image: p.images?.[0]?.url ?? null,
      tags: p.tags,
    }));

    logApiSuccess(ctx, 200, {
      q,
      category,
      tag,
      sort,
      limit,
      page,
      count: botProducts.length,
    });

    return jsonOk(
      {
        products: botProducts,
        pagination: {
          page,
          limit,
          count: botProducts.length,
          hasMore: botProducts.length === limit,
        },
      },
      ctx,
    );
  } catch (error) {
    logApiError(ctx, 500, error, { q, category, tag, sort, limit });
    return jsonError("Unable to load products", 500, ctx);
  }
}
