import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getBrandInfo } from "@/lib/utils/brands";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        qaStatus: { not: "REJECTED" },
      },
      select: { tags: true, titleEn: true },
    });

    const brandsSet = new Set<string>();
    products.forEach((product) => {
      const brand = getBrandInfo({ tags: product.tags, titleEn: product.titleEn });
      if (brand?.tag) {
        brandsSet.add(brand.tag);
      }
    });

    const brands = Array.from(brandsSet)
      .map((tag) => ({
        tag,
        label: getBrandInfo({ tags: [tag] })?.label ?? tag,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((item) => item.tag);

    const response = NextResponse.json({ brands });
    response.headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    return response;
  } catch (error) {
    console.error("Failed to fetch brands:", error);
    return NextResponse.json({ brands: [] });
  }
}
