import { getAdminSession } from "@/lib/auth/admin";
import { isOpenClawAdminRequest } from "@/lib/auth/openclaw-admin";
import {
  createInflywayProduct,
  createInflywayProductsBatch,
  type CreateProductParams,
} from "@/lib/inflyway/product";
import {
  createApiContext,
  jsonError,
  jsonOk,
  logApiError,
  logApiSuccess,
  logApiWarning,
} from "@/lib/utils/api";

export const runtime = "nodejs";

/**
 * POST /api/admin/inflyway/product
 * 在 Inflyway 平台创建商品
 *
 * 单个商品:
 * {
 *   "title": "商品标题",
 *   "price": 22,
 *   "stock": 1,
 *   "currency": "USD",
 *   "categoryId": 26,
 *   "categoryName": "其他",
 *   "description": "商品描述",
 *   "imageUrl": "图片URL"
 * }
 *
 * 批量创建:
 * {
 *   "batch": true,
 *   "products": [{ ... }, { ... }]
 * }
 */
export async function POST(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  const openclawAuthorized = isOpenClawAdminRequest(request);

  if (!session && !openclawAuthorized) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  try {
    const body = await request.json();

    // 批量创建
    if (body.batch && Array.isArray(body.products)) {
      const products = body.products as CreateProductParams[];

      if (products.length === 0) {
        return jsonError("No products provided", 400, ctx, {
          code: "NO_PRODUCTS",
        });
      }

      // Basic guardrail to avoid accidental runaway calls.
      if (products.length > 200) {
        return jsonError("Too many products in batch (max 200)", 400, ctx, {
          code: "BATCH_TOO_LARGE",
        });
      }

      const result = await createInflywayProductsBatch(products);
      logApiSuccess(ctx, 200, {
        action: "batch_create",
        total: products.length,
        success: result.successCount,
        failed: result.failCount,
      });

      return jsonOk(
        {
          batch: true,
          total: products.length,
          successCount: result.successCount,
          failCount: result.failCount,
          results: result.results,
        },
        ctx
      );
    }

    // 单个创建
    const params: CreateProductParams = {
      title: body.title,
      price: body.price,
      stock: body.stock,
      currency: body.currency,
      categoryId: body.categoryId,
      categoryName: body.categoryName,
      description: body.description,
      imageUrl: body.imageUrl,
      contact: body.contact,
    };

    if (!params.title || typeof params.price !== "number") {
      return jsonError("Missing required fields: title, price", 400, ctx, {
        code: "INVALID_PARAMS",
      });
    }

    const result = await createInflywayProduct(params);

    if (result.success) {
      logApiSuccess(ctx, 200, {
        action: "create",
        productId: result.productId,
        title: params.title,
        price: params.price,
      });
      return jsonOk(result, ctx);
    }

    logApiWarning(ctx, 400, {
      action: "create",
      error: result.error,
    });
    return jsonError(result.error || "Failed to create product", 400, ctx, {
      code: "CREATE_FAILED",
    });
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Internal server error", 500, ctx, {
      code: "INTERNAL_ERROR",
    });
  }
}
