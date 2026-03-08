import { Prisma } from "@prisma/client";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { isProd, allowMockDataFallback } from "@/lib/utils/env";

export type BrandWithCount = Prisma.BrandGetPayload<{
  include: { _count: { select: { products: true } } };
}>;

export async function getBrands(): Promise<BrandWithCount[]> {
  try {
    return await prisma.brand.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    if (isProd && !allowMockDataFallback) {
      throw error;
    }
    console.warn("Prisma unavailable, returning empty brands.", error instanceof Error ? error.message : error);
    return [];
  }
}

export const getBrandBySlug = cache(async (slug: string) => {
  try {
    return await prisma.brand.findFirst({
      where: { slug, isActive: true },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
  } catch (error) {
    if (isProd && !allowMockDataFallback) {
      throw error;
    }
    console.warn("Prisma unavailable, returning null brand.", error instanceof Error ? error.message : error);
    return null;
  }
});

export async function getPopularBrands(limit = 12): Promise<BrandWithCount[]> {
  try {
    const brands = await prisma.brand.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: {
        products: {
          _count: "desc",
        },
      },
      take: limit,
    });
    return brands;
  } catch (error) {
    if (isProd && !allowMockDataFallback) {
      throw error;
    }
    console.warn("Prisma unavailable, returning empty brands.", error instanceof Error ? error.message : error);
    return [];
  }
}
