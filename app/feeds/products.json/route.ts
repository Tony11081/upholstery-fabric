import { prisma } from "@/lib/prisma";
import { absoluteUrl, getSiteUrl } from "@/lib/utils/site";
import { getProductAttributeValues } from "@/lib/seo/product-attributes";
import { getBrandInfo } from "@/lib/utils/brands";

export const dynamic = "force-dynamic";

export async function GET() {
  const siteUrl = getSiteUrl();
  const products = await prisma.product.findMany({
    where: { isActive: true, qaStatus: { not: "REJECTED" } },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      brand: true,
      category: true,
      images: {
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
      },
      variants: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const payload = {
    site: siteUrl,
    generatedAt: new Date().toISOString(),
    currency: "USD",
    unit: "1 yard",
    productCount: products.length,
    products: products.map((product) => {
      const attributes = getProductAttributeValues(product);
      const brandName = product.brand?.name ?? getBrandInfo({ tags: product.tags, titleEn: product.titleEn })?.label ?? null;
      const imageUrls = product.images.map((image) =>
        image.url.startsWith("http") ? image.url : absoluteUrl(image.url),
      );
      const link = absoluteUrl(`/product/${product.slug}`);
      const price = Number(product.price);

      return {
        id: product.id,
        slug: product.slug,
        title: product.titleEn,
        description: product.descriptionEn ?? "",
        link,
        image: imageUrls[0] ?? null,
        images: imageUrls,
        brand: brandName,
        category: product.category?.nameEn ?? null,
        availability: product.inventory > 0 ? "in_stock" : "backorder",
        condition: "new",
        currency: product.currency,
        price,
        unitPrice: price,
        unit: "1 yard",
        inventory: product.inventory,
        colors: attributes.colors,
        sizes: attributes.sizes,
        materials: attributes.materials,
        updatedAt: product.updatedAt.toISOString(),
      };
    }),
  };

  return Response.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
