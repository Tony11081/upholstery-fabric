import { filterMockProducts, getProducts, searchProducts, type ProductSort } from "@/lib/data/products";
import { allowMockDataFallback, isProd } from "@/lib/utils/env";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";

export const revalidate = 0;

export async function GET(request: Request) {
  const ctx = createApiContext(request);
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const category = searchParams.get("category");
  const categoryGroup = searchParams.get("categoryGroup");
  const brand = searchParams.get("brand");
  const color = searchParams.get("color");
  const size = searchParams.get("size");
  const material = searchParams.get("material");
  const limit = Number(searchParams.get("limit") ?? "12");
  const page = Number(searchParams.get("page") ?? "0");
  const offset = Number.isFinite(page) && page > 0 ? page * limit : 0;
  const sort = (searchParams.get("sort") as ProductSort | null) ?? null;
  const isNew = searchParams.get("isNew") === "true";
  const tag = searchParams.get("tag");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const availability = searchParams.get("availability");
  const cacheHeaders = { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" };

  try {
    const products = q
      ? await searchProducts(q, { limit, offset })
      : await getProducts({
          category,
          categoryGroup,
          brand,
          color,
          size,
          material,
          limit,
          offset,
          sort,
          isNew,
          tag,
          minPrice: minPrice ? Number(minPrice) : null,
          maxPrice: maxPrice ? Number(maxPrice) : null,
          availability: availability === "in_stock" ? "in_stock" : null,
        });

    logApiSuccess(ctx, 200, {
      q,
      category,
      categoryGroup,
      tag,
      color,
      size,
      material,
      sort,
      isNew,
      limit,
      page,
      count: products.length,
    });
    return jsonOk({ products }, ctx, { headers: cacheHeaders });
  } catch (error) {
    if (isProd && !allowMockDataFallback) {
      logApiError(ctx, 500, error, {
        q,
        category,
        categoryGroup,
        tag,
        color,
        size,
        material,
        sort,
        isNew,
        limit,
      });
      return jsonError("Unable to load products", 500, ctx);
    }
    const products = q
      ? filterMockProducts({ limit, offset, tag: q })
      : filterMockProducts({
          category: category ?? undefined,
          categoryGroup: categoryGroup ?? undefined,
          limit,
          offset,
          sort,
          isNew,
          tag,
          color: color ?? undefined,
          size: size ?? undefined,
          material: material ?? undefined,
          minPrice: minPrice ? Number(minPrice) : null,
          maxPrice: maxPrice ? Number(maxPrice) : null,
          availability: availability === "in_stock" ? "in_stock" : null,
        });
    logApiWarning(ctx, 200, {
      q,
      category,
      categoryGroup,
      tag,
      color,
      size,
      material,
      sort,
      isNew,
      limit,
      page,
      count: products.length,
      fallback: "mock",
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonOk({ products }, ctx, { headers: cacheHeaders });
  }
}
