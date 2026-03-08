import { PrismaClient } from "@prisma/client";
import { getBrandInfo } from "../lib/utils/brands";

const prisma = new PrismaClient();

async function migrateBrands() {
  console.log("Starting brand migration...");

  // Get all products
  const products = await prisma.product.findMany({
    select: {
      id: true,
      titleEn: true,
      tags: true,
      brandId: true,
    },
  });

  console.log(`Found ${products.length} products`);

  // Extract unique brands
  const brandMap = new Map<string, { name: string; slug: string }>();

  for (const product of products) {
    const brandInfo = getBrandInfo({ tags: product.tags, titleEn: product.titleEn });
    if (brandInfo) {
      brandMap.set(brandInfo.tag, {
        name: brandInfo.label,
        slug: brandInfo.tag,
      });
    }
  }

  console.log(`Found ${brandMap.size} unique brands`);

  // Create brands in database
  const createdBrands = new Map<string, string>();

  for (const [slug, { name }] of brandMap.entries()) {
    try {
      const brand = await prisma.brand.upsert({
        where: { slug },
        create: {
          name,
          slug,
          isActive: true,
        },
        update: {
          name,
        },
      });
      createdBrands.set(slug, brand.id);
      console.log(`Created/updated brand: ${name} (${slug})`);
    } catch (error) {
      console.error(`Failed to create brand ${name}:`, error);
    }
  }

  // Update products with brandId
  let updatedCount = 0;
  for (const product of products) {
    if (product.brandId) continue; // Skip if already has brandId

    const brandInfo = getBrandInfo({ tags: product.tags, titleEn: product.titleEn });
    if (brandInfo && createdBrands.has(brandInfo.tag)) {
      const brandId = createdBrands.get(brandInfo.tag)!;
      try {
        await prisma.product.update({
          where: { id: product.id },
          data: { brandId },
        });
        updatedCount++;
      } catch (error) {
        console.error(`Failed to update product ${product.id}:`, error);
      }
    }
  }

  console.log(`Updated ${updatedCount} products with brandId`);
  console.log("Brand migration completed!");
}

migrateBrands()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
