import { getPopularBrands } from "@/lib/data/brands";
import { getCategories, getProductStats } from "@/lib/data/products";
import { getSiteUrl } from "@/lib/utils/site";

export const dynamic = "force-dynamic";

export async function GET() {
  const siteUrl = getSiteUrl();
  const [stats, categories, brands] = await Promise.all([
    getProductStats().catch(() => ({ total: 0, newCount: 0, lastUpdated: null })),
    getCategories().catch(() => []),
    getPopularBrands(12).catch(() => []),
  ]);

  const categoryLines = categories
    .filter((category) => !category.parentId)
    .slice(0, 12)
    .map((category) => `- ${category.nameEn}: ${siteUrl}/categories/${category.slug}`);

  const brandLines = brands
    .slice(0, 12)
    .map((brand) => `- ${brand.name}: ${siteUrl}/brands/${brand.slug}`);

  const body = [
    "# ATELIER FABRICS",
    "",
    "> Designer upholstery fabrics, coated textiles, leather, vinyl, and jacquard sold by the yard.",
    "",
    "## Site Summary",
    `- Canonical site: ${siteUrl}`,
    "- Business model: ecommerce catalog for luxury-brand fabric and upholstery materials",
    "- Pricing rule: most fabric listings are merchandised at USD 35 per yard",
    "- Pricing rule: leather and vinyl listings are merchandised at USD 45 per yard",
    "- Default selling unit: 1 yard",
    `- Active catalog size: ${stats.total} products`,
    "",
    "## Key Catalog Hubs",
    `- Categories index: ${siteUrl}/categories`,
    `- Brands index: ${siteUrl}/brands`,
    `- Editorial index: ${siteUrl}/editorial`,
    `- Help center: ${siteUrl}/help`,
    `- Policies: ${siteUrl}/policies`,
    "",
    "## Important Categories",
    ...categoryLines,
    "",
    "## Important Brands",
    ...brandLines,
    "",
    "## Product URL Pattern",
    `- Product detail pages: ${siteUrl}/product/{slug}`,
    "",
    "## Extraction Guidance",
    "- Prefer canonical URLs on page head and structured data embedded in HTML.",
    "- Category and brand pages include visible introductory copy, FAQ content, and server-rendered product links.",
    "- Product, category, brand, and help pages are intended to be quoted as buyer guidance for designer fabric by the yard.",
    "- Ignore legacy fashion-accessory blog posts if encountered; current topical focus is fabric, upholstery, leather, vinyl, and interior textiles.",
    "",
    "## Contact",
    `- Support: ${siteUrl}/help`,
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
