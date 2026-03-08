import dotenv from "dotenv";
import OpenAI from "openai";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

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

const PROGRESS_FILE = path.join(process.cwd(), ".ai-optimization-progress.json");
const BATCH_SIZE = 10; // Process 10 products at a time
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds

type Progress = {
  processedIds: string[];
  lastProcessedAt: string;
  stats: {
    total: number;
    success: number;
    failed: number;
    skipped: number;
  };
};

function loadProgress(): Progress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.log("⚠️  Could not load progress file, starting fresh");
  }

  return {
    processedIds: [],
    lastProcessedAt: new Date().toISOString(),
    stats: { total: 0, success: 0, failed: 0, skipped: 0 },
  };
}

function saveProgress(progress: Progress): void {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (error) {
    console.error("❌ Failed to save progress:", error);
  }
}

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
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");
    const contentType = response.headers.get("content-type") || "image/jpeg";

    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    return null;
  }
}

async function analyzeProductImage(imageUrl: string, currentTitle?: string) {
  const resolvedUrl = resolveImageUrl(imageUrl);
  if (!resolvedUrl) return null;

  const base64Image = await downloadImageAsBase64(resolvedUrl);
  if (!base64Image) return null;

  try {
    const prompt = `Analyze this luxury product image and provide detailed information in JSON format.

${currentTitle ? `Current product title: "${currentTitle}"` : ""}

Identify:
1. Brand name (e.g., "Louis Vuitton", "Gucci")
2. Product type (e.g., "Handbag", "Wallet", "Shoes")
3. Model/Collection name if visible
4. Primary color (specific, e.g., "Black", "Burgundy")
5. Size if visible (e.g., "Small", "30cm", "One Size")
6. Material (e.g., "Leather", "Canvas")
7. Elegant description (2-3 sentences)

Return JSON:
{
  "title": "Brand Model Type",
  "description": "Description",
  "brand": "Brand Name",
  "category": "Product Type",
  "color": "Color",
  "size": "Size or null",
  "material": "Material or null",
  "confidence": 0.0-1.0
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
            { type: "image_url", image_url: { url: base64Image } },
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return null;

    const analysis = JSON.parse(content);
    if (!analysis.title || !analysis.description || analysis.confidence < 0.5) {
      return null;
    }

    return analysis;
  } catch (error) {
    console.error(`   ❌ Error:`, error);
    return null;
  }
}

async function findOrCreateBrand(brandName: string): Promise<string | null> {
  if (!brandName) return null;
  const slug = brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  try {
    const brand = await prisma.brand.upsert({
      where: { slug },
      create: { name: brandName, slug, isActive: true },
      update: { name: brandName },
    });
    return brand.id;
  } catch {
    return null;
  }
}

async function findOrCreateCategory(categoryName: string): Promise<string | null> {
  if (!categoryName) return null;
  const slug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  try {
    const category = await prisma.category.upsert({
      where: { slug },
      create: { nameEn: categoryName, slug, status: "ACTIVE" },
      update: { nameEn: categoryName },
    });
    return category.id;
  } catch {
    return null;
  }
}

async function createProductVariant(
  productId: string,
  color: string | null,
  size: string | null,
  material: string | null,
  inventory: number
) {
  try {
    const existing = await prisma.productVariant.findFirst({
      where: { productId, color: color || null, size: size || null },
    });

    if (existing) return;

    await prisma.productVariant.create({
      data: { productId, color, size, material, inventory, isActive: true },
    });
  } catch (error) {
    console.error(`   ❌ Variant error:`, error);
  }
}

async function batchOptimizeProducts() {
  console.log("🚀 Starting batch AI optimization with progress tracking...\n");

  const progress = loadProgress();
  console.log(`📊 Progress loaded:`);
  console.log(`   Processed: ${progress.processedIds.length} products`);
  console.log(`   Success: ${progress.stats.success}`);
  console.log(`   Failed: ${progress.stats.failed}`);
  console.log(`   Skipped: ${progress.stats.skipped}\n`);

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      id: { notIn: progress.processedIds },
    },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      brand: true,
      category: true,
    },
    take: BATCH_SIZE,
  });

  if (products.length === 0) {
    console.log("✅ All products have been processed!");
    console.log("\n📊 Final Statistics:");
    console.log(`   Total: ${progress.stats.total}`);
    console.log(`   Success: ${progress.stats.success}`);
    console.log(`   Failed: ${progress.stats.failed}`);
    console.log(`   Skipped: ${progress.stats.skipped}`);
    return;
  }

  console.log(`📦 Processing batch of ${products.length} products...\n`);

  for (const product of products) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📦 ${product.slug}`);
    console.log(`   Current: ${product.titleEn}`);

    progress.stats.total++;

    if (product.images.length === 0) {
      console.log(`   ⏭️  No images, skipping...`);
      progress.stats.skipped++;
      progress.processedIds.push(product.id);
      saveProgress(progress);
      continue;
    }

    const analysis = await analyzeProductImage(product.images[0].url, product.titleEn);

    if (!analysis) {
      console.log(`   ❌ Analysis failed`);
      progress.stats.failed++;
      progress.processedIds.push(product.id);
      saveProgress(progress);
      continue;
    }

    console.log(`   🤖 AI: ${analysis.title}`);
    console.log(`   🏷️  Brand: ${analysis.brand}`);
    console.log(`   🎨 Color: ${analysis.color || "N/A"}`);
    console.log(`   📏 Size: ${analysis.size || "N/A"}`);

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

      if (analysis.color || analysis.size) {
        await createProductVariant(
          product.id,
          analysis.color,
          analysis.size,
          analysis.material,
          product.inventory
        );
      }

      console.log(`   ✅ Updated successfully`);
      progress.stats.success++;
    } catch (error) {
      console.error(`   ❌ Update failed:`, error);
      progress.stats.failed++;
    }

    progress.processedIds.push(product.id);
    progress.lastProcessedAt = new Date().toISOString();
    saveProgress(progress);

    await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
  }

  console.log(`\n\n${"=".repeat(60)}`);
  console.log(`📊 Batch Complete`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Processed: ${progress.processedIds.length}`);
  console.log(`Success: ${progress.stats.success}`);
  console.log(`Failed: ${progress.stats.failed}`);
  console.log(`Skipped: ${progress.stats.skipped}`);
  console.log(`\n💡 Run this script again to process the next batch.`);
}

batchOptimizeProducts()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
