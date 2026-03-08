import { getLiveSuggestions } from "@/lib/data/products";
import { isProd } from "@/lib/utils/env";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";

export const revalidate = 0;

export async function GET(request: Request) {
  const ctx = createApiContext(request);
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const limit = Number(searchParams.get("limit") ?? "6");

  try {
    const { products, categories, brands = [] } = await getLiveSuggestions(q);
    logApiSuccess(ctx, 200, {
      q,
      limit,
      products: products.length,
      categories: categories.length,
      brands: brands.length,
    });
    return jsonOk({
      products: products.slice(0, limit),
      categories: categories.slice(0, 6),
      brands: brands.slice(0, 6),
    }, ctx);
  } catch (error) {
    if (isProd) {
      logApiError(ctx, 500, error, { q, limit });
      return jsonError("Unable to fetch suggestions", 500, ctx);
    }
    logApiWarning(ctx, 200, {
      q,
      limit,
      fallback: "mock",
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonOk({ products: [], categories: [], brands: [] }, ctx);
  }
}
