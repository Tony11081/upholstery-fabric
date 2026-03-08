import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Common colors in luxury products
const COLORS = [
  "black", "white", "red", "blue", "green", "yellow", "pink", "purple",
  "brown", "grey", "gray", "beige", "navy", "gold", "silver", "bronze",
  "cream", "ivory", "tan", "burgundy", "maroon", "olive", "khaki"
];

// Common sizes
const SIZES = [
  "xs", "s", "m", "l", "xl", "xxl", "xxxl",
  "small", "medium", "large", "extra large",
  "one size", "onesize", "os",
  // Shoe sizes
  "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45",
  "5", "6", "7", "8", "9", "10", "11", "12", "13", "14"
];

function extractColorFromText(text: string): string | null {
  const lowerText = text.toLowerCase();
  for (const color of COLORS) {
    if (lowerText.includes(color)) {
      return color.charAt(0).toUpperCase() + color.slice(1);
    }
  }
  return null;
}

function extractSizeFromText(text: string): string | null {
  const lowerText = text.toLowerCase();
  for (const size of SIZES) {
    const regex = new RegExp(`\\b${size}\\b`, "i");
    if (regex.test(lowerText)) {
      return size.toUpperCase();
    }
  }
  return null;
}

function extractFromTags(tags: string[]): { colors: string[]; sizes: string[] } {
  const colors: string[] = [];
  const sizes: string[] = [];

  for (const tag of tags) {
    const lowerTag = tag.toLowerCase();

    // Check for color tags
    if (lowerTag.startsWith("color:") || lowerTag.startsWith("colour:")) {
      const color = tag.split(":")[1]?.trim();
      if (color) colors.push(color);
    } else {
      const color = extractColorFromText(tag);
      if (color && !colors.includes(color)) colors.push(color);
    }

    // Check for size tags
    if (lowerTag.startsWith("size:")) {
      const size = tag.split(":")[1]?.trim();
      if (size) sizes.push(size.toUpperCase());
    } else {
      const size = extractSizeFromText(tag);
      if (size && !sizes.includes(size)) sizes.push(size);
    }
  }

  return { colors, sizes };
}

async function createVariants() {
  console.log("Starting variant creation...");

  const products = await prisma.product.findMany({
    select: {
      id: true,
      titleEn: true,
      descriptionEn: true,
      tags: true,
      price: true,
      inventory: true,
    },
  });

  console.log(`Found ${products.length} products`);

  let createdCount = 0;
  let skippedCount = 0;

  for (const product of products) {
    // Check if variants already exist
    const existingVariants = await prisma.productVariant.count({
      where: { productId: product.id },
    });

    if (existingVariants > 0) {
      skippedCount++;
      continue;
    }

    // Extract colors and sizes from tags and text
    const tagData = extractFromTags(product.tags);
    const titleColor = extractColorFromText(product.titleEn);
    const descColor = product.descriptionEn ? extractColorFromText(product.descriptionEn) : null;
    const titleSize = extractSizeFromText(product.titleEn);
    const descSize = product.descriptionEn ? extractSizeFromText(product.descriptionEn) : null;

    const colors = Array.from(new Set([
      ...tagData.colors,
      ...(titleColor ? [titleColor] : []),
      ...(descColor ? [descColor] : []),
    ]));

    const sizes = Array.from(new Set([
      ...tagData.sizes,
      ...(titleSize ? [titleSize] : []),
      ...(descSize ? [descSize] : []),
    ]));

    // Create variants
    if (colors.length > 0 || sizes.length > 0) {
      // Create variants for each color-size combination
      const colorList = colors.length > 0 ? colors : [null];
      const sizeList = sizes.length > 0 ? sizes : [null];

      for (const color of colorList) {
        for (const size of sizeList) {
          try {
            await prisma.productVariant.create({
              data: {
                productId: product.id,
                color,
                size,
                inventory: Math.floor(product.inventory / (colorList.length * sizeList.length)),
                isActive: true,
              },
            });
            createdCount++;
          } catch (error) {
            console.error(`Failed to create variant for product ${product.id}:`, error);
          }
        }
      }
    } else {
      // Create a default variant if no color/size found
      try {
        await prisma.productVariant.create({
          data: {
            productId: product.id,
            inventory: product.inventory,
            isActive: true,
          },
        });
        createdCount++;
      } catch (error) {
        console.error(`Failed to create default variant for product ${product.id}:`, error);
      }
    }
  }

  console.log(`Created ${createdCount} variants`);
  console.log(`Skipped ${skippedCount} products (already have variants)`);
  console.log("Variant creation completed!");
}

createVariants()
  .catch((error) => {
    console.error("Variant creation failed:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
