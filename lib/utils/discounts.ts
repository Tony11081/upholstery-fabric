import type { DiscountScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DiscountRow = {
  scope: DiscountScope;
  percentage: number;
  productId: string | null;
  categoryId: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
};

export type DiscountMaps = {
  globalPercent: number;
  productPercents: Map<string, number>;
  categoryPercents: Map<string, number>;
};

const DISCOUNT_CACHE_MS = 60_000;
let discountCache: { value: DiscountMaps; expiresAt: number } | null = null;

function isActiveWindow(row: DiscountRow, now: Date) {
  if (row.startsAt && row.startsAt > now) return false;
  if (row.endsAt && row.endsAt < now) return false;
  return true;
}

export async function getActiveDiscounts(): Promise<DiscountMaps> {
  const nowMs = Date.now();
  if (discountCache && discountCache.expiresAt > nowMs) {
    return discountCache.value;
  }

  const rows = await prisma.discount.findMany({
    where: { active: true },
    select: {
      scope: true,
      percentage: true,
      productId: true,
      categoryId: true,
      startsAt: true,
      endsAt: true,
    },
  });

  const now = new Date();
  const productPercents = new Map<string, number>();
  const categoryPercents = new Map<string, number>();
  let globalPercent = 0;

  rows.forEach((row) => {
    if (!isActiveWindow(row, now)) return;
    const percent = Math.max(0, Math.min(100, row.percentage));
    if (row.scope === "GLOBAL") {
      globalPercent = Math.max(globalPercent, percent);
      return;
    }
    if (row.scope === "PRODUCT" && row.productId) {
      productPercents.set(row.productId, Math.max(productPercents.get(row.productId) ?? 0, percent));
      return;
    }
    if (row.scope === "CATEGORY" && row.categoryId) {
      categoryPercents.set(row.categoryId, Math.max(categoryPercents.get(row.categoryId) ?? 0, percent));
    }
  });

  const value = { globalPercent, productPercents, categoryPercents };
  discountCache = { value, expiresAt: nowMs + DISCOUNT_CACHE_MS };
  return value;
}

export function resolveDiscountPercent(
  productId: string,
  categoryId: string | null | undefined,
  discounts: DiscountMaps,
) {
  const productPercent = discounts.productPercents.get(productId);
  if (productPercent) return productPercent;
  if (categoryId) {
    const categoryPercent = discounts.categoryPercents.get(categoryId);
    if (categoryPercent) return categoryPercent;
  }
  return discounts.globalPercent;
}

export function applyDiscount(price: number, percent: number) {
  if (!percent) return price;
  const factor = (100 - percent) / 100;
  return Math.round(price * factor * 100) / 100;
}
