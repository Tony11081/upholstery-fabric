import { prisma } from "@/lib/prisma";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning, maskEmail } from "@/lib/utils/api";
import { upsertCustomer } from "@/lib/data/customers";

type Body = {
  productId?: string;
  rating?: number;
  title?: string;
  body?: string;
  email?: string;
};

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx);
  }

  const productId = body.productId?.trim();
  const rating = body.rating ?? 0;
  if (!productId || rating < 1 || rating > 5) {
    logApiWarning(ctx, 400, { reason: "invalid_fields", productId, rating });
    return jsonError("Product and rating are required", 400, ctx);
  }

  try {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      logApiWarning(ctx, 404, { productId });
      return jsonError("Product not found", 404, ctx);
    }

    let customerId: string | undefined;
    const email = body.email?.trim().toLowerCase();
    if (email) {
      const { customer } = await upsertCustomer({ email });
      customerId = customer.id;
    }

    const review = await prisma.review.create({
      data: {
        productId,
        customerId,
        rating,
        title: body.title?.trim() || null,
        body: body.body?.trim() || null,
        status: "PENDING",
      },
    });

    logApiSuccess(ctx, 200, { reviewId: review.id, email: maskEmail(email) });
    return jsonOk({ reviewId: review.id }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { productId, rating });
    return jsonError("Unable to submit review", 500, ctx);
  }
}

