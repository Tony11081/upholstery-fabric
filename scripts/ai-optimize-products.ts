import dotenv from "dotenv";
import OpenAI from "openai";
import { PrismaClient } from "@prisma/client";

dotenv.config();
dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();
const openRouterApiKey = process.env.OPENROUTER_API_KEY ?? "";
if (!openRouterApiKey) {
  throw new Error("OPENROUTER_API_KEY is required");
}
const openai = new OpenAI({
  apiKey: openRouterApiKey,
  baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
});
const model = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

type ProductAnalysis = {
  title: string;
  description: string;
  brand: string | null;
  category: string | null;
  color: string | null;
  size: string | null;
  material: string | null;
  confidence: number;
};

function resolveImageUrl(url: string): string | null {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith("/api/image?url=")) {
    try {
      const urlParam = url.split("url=")[1];
      return decodeURIComponent(urlParam);
    } catch {
      return null;
    }
  }

  return null;
}

async function downloadImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.log(`   ⚠️  Failed to download image: ${response.status}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");
    const contentType = response.headers.get("content-type") || "image/jpeg";

    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error(`   ❌ Error downloading image:`, error);
    return null;
  }
}

async function analyzeProductImage(imageUrl: string, currentTitle?: string): Promise<ProductAnalysis | null> {
  const resolvedUrl = resolveImageUrl(imageUrl);

  if (!resolvedUrl) {
    console.log(`   ⚠️  Cannot resolve image URL: ${imageUrl}`);
    return null;
  }

  console.log(`   📥 Downloading image...`);
  const base64Image = await downloadImageAsBase64(resolvedUrl);

  if (!base64Image) {
    return null;
  }

  try {
    const prompt = `Analyze this luxury product image and provide detailed information in JSON format.

${currentTitle ? `Current product title: "${currentTitle}"` : ""}

Please identify:
1. Brand name (e.g., "Louis Vuitton", "Gucci", "Chanel")
2. Product type (e.g., "Handbag", "Wallet", "Shoes", "Watch")
3. Model/Collection name if visible
4. Primary color (be specific, e.g., "Black", "Burgundy", "Navy Blue")
5. Size if visible (e.g., "Small", "Medium", "30cm", "One Size")
6. Material if identifiable (e.g., "Leather", "Canvas", "Suede")
7. A concise, elegant product description (2-3 sentences)

Return ONLY a JSON object with this exact structure:
{
  "title": "Brand Model Type",
  "description": "Elegant 2-3 sentence description",
  "brand": "Brand Name",
  "category": "Product Type",
  "color": "Primary Color",
  "size": "Size or null",
  "material": "Material or null",
  "confidence": 0.0-1.0
}

Example:
{
  "title": "Louis Vuitton Speedy 30 Handbag",
  "description": "Iconic Louis Vuitton Speedy 30 in classic monogram canvas. Features signature leather handles and brass hardware. A timeless piece perfect for everyday luxury.",
  "brand": "Louis Vuitton",
  "category": "Handbag",
  "color": "Brown",
  "size": "30cm",
  "material": "Canvas",
  "confidence": 0.95
}`;

    const response = await openai.chat.completions.create({
      model,
      max_tokens: 500,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: base64Image,
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    if (!response.choices || response.choices.length === 0) {
      console.log(`   ⚠️  No response from API`);
      return null;
    }

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      console.log(`   ⚠️  Empty response`);
      return null;
    }

    const analysis = JSON.parse(content) as ProductAnalysis;

    // Validate the response
    if (!analysis.title || !analysis.description || analysis.confidence < 0.5) {
      console.log(`   ⚠️  Low confidence or invalid response: ${analysis.confidence}`);
      return null;
    }

    return analysis;
  } catch (error) {
    console.error(`   ❌ Error analyzing image:`, error);
    return null;
  }
}

async function findOrCreateBrand(brandName: string): Promise<string | null> {
  if (!brandName) return null;

  const slug = brandName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  try {
    const brand = await prisma.brand.upsert({
      where: { slug },
      create: {
        name: brandName,
        slug,
        isActive: true,
      },
      update: {
        name: brandName,
      },
    });

    return brand.id;
  } catch (error) {
    console.error(`   ❌ Error creating brand:`, error);
    return null;
  }
}

async function findOrCreateCategory(categoryName: string): Promise<string | null> {
  if (!categoryName) return null;

  const slug = categoryName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  try {
    const category = await prisma.category.upsert({
      where: { slug },
      create: {
        nameEn: categoryName,
        slug,
        status: "ACTIVE",
      },
      update: {
        nameEn: categoryName,
      },
    });

    return category.id;
  } catch (error) {
    console.error(`   ❌ Error creating category:`, error);
    return null;
  }
}

async function createProductVariant(
  productId: string,
  color: string | null,
  size: string | null,
  material: string | null,
  inventory: number
): Promise<void> {
  try {
    // Check if variant already exists
    const existing = await prisma.productVariant.findFirst({
      where: {
        productId,
        color: color || null,
        size: size || null,
      },
    });

    if (existing) {
      console.log(`   ℹ️  Variant already exists, skipping...`);
      return;
    }

    await prisma.productVariant.create({
      data: {
        productId,
        color,
        size,
        material,
        inventory,
        isActive: true,
      },
    });

    console.log(`   ✅ Created variant: ${color || "N/A"} / ${size || "N/A"}`);
  } catch (error) {
    console.error(`   ❌ Error creating variant:`, error);
  }
}

async function optimizeProductData() {
  console.log("🚀 Starting AI-powered product data optimization...\n");

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      brand: true,
      category: true,
      variants: true,
    },
  });

  console.log(`Found ${products.length} products to process\n`);

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  for (const product of products) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`📦 Processing: ${product.slug}`);
    console.log(`   Current title: ${product.titleEn}`);

    if (product.images.length === 0) {
      console.log(`   ⚠️  No images, skipping...`);
      skippedCount++;
      continue;
    }

    const firstImage = product.images[0];
    console.log(`   Image URL: ${firstImage.url}`);

    const analysis = await analyzeProductImage(firstImage.url, product.titleEn);

    if (!analysis) {
      console.log(`   ❌ Failed to analyze product`);
      failCount++;
      continue;
    }

    console.log(`\n   🤖 AI Analysis:`);
    console.log(`      Title: ${analysis.title}`);
    console.log(`      Brand: ${analysis.brand}`);
    console.log(`      Category: ${analysis.category}`);
    console.log(`      Color: ${analysis.color}`);
    console.log(`      Size: ${analysis.size}`);
    console.log(`      Material: ${analysis.material}`);
    console.log(`      Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);

    // Update product
    try {
      const brandId = analysis.brand ? await findOrCreateBrand(analysis.brand) : null;
      const categoryId = analysis.category ? await findOrCreateCategory(analysis.category) : null;

      await prisma.product.update({
        where: { id: product.id },
        data: {
          titleEn: analysis.title,
          descriptionEn: analysis.description,
          brandId: brandId || product.brandId,
          categoryId: categoryId || product.categoryId,
        },
      });

      console.log(`   ✅ Updated product data`);

      // Create variant if color or size detected
      if (analysis.color || analysis.size) {
        await createProductVariant(
          product.id,
          analysis.color,
          analysis.size,
          analysis.material,
          product.inventory
        );
      }

      successCount++;
    } catch (error) {
      console.error(`   ❌ Error updating product:`, error);
      failCount++;
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log(`\n\n${"=".repeat(80)}`);
  console.log(`📊 Summary`);
  console.log(`${"=".repeat(80)}`);
  console.log(`Total products: ${products.length}`);
  console.log(`✅ Successfully optimized: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`⏭️  Skipped: ${skippedCount}`);
  console.log(`${"=".repeat(80)}\n`);
}

optimizeProductData()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
