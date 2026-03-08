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

function isValidProductName(text: string): boolean {
  const invalidPatterns = [
    /I don't see/i,
    /I can't identify/i,
    /I don't have/i,
    /I cannot/i,
    /cannot identify/i,
    /unable to/i,
    /could you clarify/i,
    /please share/i,
    /would need/i,
  ];

  return !invalidPatterns.some((pattern) => pattern.test(text));
}

async function identifyProductFromImage(imageUrl: string): Promise<string | null> {
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
    const response = await openai.chat.completions.create({
      model,
      max_tokens: 200,
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
              text: "Identify this luxury product and provide ONLY the product name in English. Be specific about the brand, model, and type. Format: [Brand] [Model/Collection] [Type]. Example: 'Louis Vuitton Speedy 30 Handbag' or 'Gucci Dionysus Shoulder Bag'. Return only the product name, nothing else.",
            },
          ],
        },
      ],
    });

    if (!response.choices || response.choices.length === 0) {
      console.log(`   ⚠️  No response from API`);
      console.log(`   Response:`, JSON.stringify(response, null, 2));
      return null;
    }

    const productName = response.choices[0]?.message?.content?.trim();

    if (productName && isValidProductName(productName)) {
      return productName;
    } else {
      console.log(`   ⚠️  Invalid response: ${productName}`);
      return null;
    }
  } catch (error) {
    console.error(`   ❌ Error identifying image:`, error);
    return null;
  }
}

async function updateProductNames() {
  console.log("Starting product name update from images...\n");

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });

  console.log(`Found ${products.length} products to process\n`);

  let successCount = 0;
  let failCount = 0;

  for (const product of products) {
    if (product.images.length === 0) {
      console.log(`⚠️  Product ${product.id} has no images, skipping...`);
      failCount++;
      continue;
    }

    const firstImage = product.images[0];
    console.log(`\n📸 Processing: ${product.slug}`);
    console.log(`   Current title: ${product.titleEn}`);
    console.log(`   Image URL: ${firstImage.url}`);

    const identifiedName = await identifyProductFromImage(firstImage.url);

    if (identifiedName) {
      console.log(`   ✅ Identified as: ${identifiedName}`);

      await prisma.product.update({
        where: { id: product.id },
        data: { titleEn: identifiedName },
      });

      console.log(`   ✅ Updated successfully`);
      successCount++;
    } else {
      console.log(`   ❌ Failed to identify product`);
      failCount++;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`\n\n=== Summary ===`);
  console.log(`Total products: ${products.length}`);
  console.log(`✅ Successfully updated: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);

  await prisma.$disconnect();
}

updateProductNames().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
