import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";
import { getAdminSession } from "@/lib/auth/admin";
import { isOpenClawAdminRequest } from "@/lib/auth/openclaw-admin";
import { notifyBackInStock } from "@/lib/data/inventory-alerts";
import { scheduleAutomations } from "@/lib/automation/engine";

type BulkAction =
  | "set_active"
  | "set_inactive"
  | "set_inventory"
  | "set_price"
  | "adjust_price"
  | "adjust_inventory"
  | "mark_new"
  | "mark_not_new"
  | "mark_best_seller"
  | "mark_not_best_seller";

type BulkPayload = {
  ids: string[];
  action: BulkAction;
  value?: number;
};

async function notifyPriceDrop(
  products: Array<{ id: string; titleEn: string; slug: string; currency: string; price: Prisma.Decimal }>,
  nextPrice: number,
) {
  const dropped = products.filter((product) => Number(product.price) > nextPrice);
  if (!dropped.length) return;

  await prisma.productPriceHistory.createMany({
    data: dropped.map((product) => ({
      productId: product.id,
      price: new Prisma.Decimal(nextPrice),
      currency: product.currency,
    })),
  });

  await Promise.all(
    dropped.map(async (product) => {
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
    }),
  );
}

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  const openclawAuthorized = isOpenClawAdminRequest(request);
  if (!session && !openclawAuthorized) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  let body: BulkPayload;
  try {
    body = (await request.json()) as BulkPayload;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx, { code: "INVALID_BODY" });
  }

  if (!body.ids?.length) {
    logApiWarning(ctx, 400, { reason: "missing_ids" });
    return jsonError("Product ids are required", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  try {
    const ids = body.ids;
    let updated = 0;

    if (body.action === "set_active") {
      const res = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { isActive: true } });
      updated = res.count;
    } else if (body.action === "set_inactive") {
      const res = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { isActive: false } });
      updated = res.count;
    } else if (body.action === "set_inventory") {
      if (typeof body.value !== "number") {
        return jsonError("Inventory value is required", 400, ctx, { code: "VALIDATION_FAILED" });
      }
      const products = await prisma.product.findMany({
        where: { id: { in: ids } },
        select: { id: true, slug: true, titleEn: true, inventory: true },
      });
      const res = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { inventory: body.value } });
      updated = res.count;
      if (body.value > 0) {
        const restockTargets = products.filter((product) => product.inventory <= 0);
        await Promise.all(
          restockTargets.map((product) =>
            notifyBackInStock({ id: product.id, slug: product.slug, titleEn: product.titleEn }),
          ),
        );
      }
    } else if (body.action === "set_price") {
      if (typeof body.value !== "number") {
        return jsonError("Price value is required", 400, ctx, { code: "VALIDATION_FAILED" });
      }
      const products = await prisma.product.findMany({
        where: { id: { in: ids } },
        select: { id: true, price: true, slug: true, titleEn: true, currency: true },
      });
      const res = await prisma.product.updateMany({
        where: { id: { in: ids } },
        data: { price: new Prisma.Decimal(body.value) },
      });
      updated = res.count;
      await notifyPriceDrop(products, body.value);
    } else if (body.action === "adjust_price") {
      if (typeof body.value !== "number") {
        return jsonError("Adjustment value is required", 400, ctx, { code: "VALIDATION_FAILED" });
      }
      const products = await prisma.product.findMany({
        where: { id: { in: ids } },
        select: { id: true, price: true, slug: true, titleEn: true, currency: true },
      });
      await Promise.all(
        products.map(async (product) => {
          const currentPrice = Number(product.price);
          const nextPrice = currentPrice + body.value!;
          await prisma.product.update({
            where: { id: product.id },
            data: { price: new Prisma.Decimal(nextPrice) },
          });
          if (nextPrice !== currentPrice) {
            await prisma.productPriceHistory.create({
              data: {
                productId: product.id,
                price: new Prisma.Decimal(nextPrice),
                currency: product.currency,
              },
            });
          }
          if (nextPrice < currentPrice) {
            const subscriptions = await prisma.subscription.findMany({
              where: { type: "PRICE_DROP", productId: product.id, active: true },
            });
            await Promise.all(
              subscriptions.map((subscription) =>
                scheduleAutomations("PRICE_DROP", {
                  customerId: subscription.customerId,
                  email: subscription.email,
                  metadata: {
                    productId: product.id,
                    slug: product.slug,
                    title: product.titleEn,
                    price: nextPrice,
                  },
                }),
              ),
            );
          }
        }),
      );
      updated = products.length;
    } else if (body.action === "adjust_inventory") {
      if (typeof body.value !== "number") {
        return jsonError("Adjustment value is required", 400, ctx, { code: "VALIDATION_FAILED" });
      }
      const products = await prisma.product.findMany({ where: { id: { in: ids } } });
      await Promise.all(
        products.map(async (product) => {
          const nextInventory = product.inventory + body.value!;
          await prisma.product.update({
            where: { id: product.id },
            data: { inventory: nextInventory },
          });
          if (product.inventory <= 0 && nextInventory > 0) {
            await notifyBackInStock({ id: product.id, slug: product.slug, titleEn: product.titleEn });
          }
        }),
      );
      updated = products.length;
    } else if (body.action === "mark_new") {
      const res = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { isNew: true } });
      updated = res.count;
    } else if (body.action === "mark_not_new") {
      const res = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { isNew: false } });
      updated = res.count;
    } else if (body.action === "mark_best_seller") {
      const res = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { isBestSeller: true } });
      updated = res.count;
    } else if (body.action === "mark_not_best_seller") {
      const res = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { isBestSeller: false } });
      updated = res.count;
    } else {
      logApiWarning(ctx, 400, { reason: "invalid_action", action: body.action });
      return jsonError("Invalid bulk action", 400, ctx, { code: "INVALID_ACTION" });
    }

    logApiSuccess(ctx, 200, { action: body.action, updated });
    return jsonOk({ updated }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { action: body.action });
    return jsonError("Bulk update failed", 500, ctx, { code: "BULK_UPDATE_FAILED" });
  }
}
