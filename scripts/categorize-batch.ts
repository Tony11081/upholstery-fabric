import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

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
const categoryMode = (process.env.AI_CATEGORY_MODE ?? "flat").toLowerCase();
const useBrandHierarchy = categoryMode === "brand" || categoryMode === "hierarchy";

interface ProductInfo {
  brand: string;
  collection?: string;
  category: string;
  fullName: string;
}

async function identifyProductDetails(imageUrl: string): Promise<ProductInfo | null> {
  try {
    const resolvedUrl = resolveImageUrl(imageUrl);
    if (!resolvedUrl) return null;

    const base64Image = await downloadImageAsBase64(resolvedUrl);
    if (!base64Image) return null;

    const response = await openai.chat.completions.create({
      model,
      max_tokens: 300,
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: base64Image } },
          {
            type: "text",
            text: `Identify this luxury product and return the information in this exact JSON format:
{
  "brand": "Brand Name",
  "collection": "Model/Collection name (short, empty if unknown)",
  "category": "Product Type",
  "fullName": "Brand + Collection/Model + Product Type"
}

Rules:
- Always include brand and category.
- If collection is unknown, set it to an empty string.
- fullName should be "Brand Collection Category" or "Brand Category" if collection is empty.

Brand examples: Louis Vuitton, Gucci, Chanel, Hermes, Prada, Dior, Fendi, Balenciaga, Bottega Veneta, Celine
Category examples: Handbag, Wallet, Card Holder, Clutch, Tote Bag, Shoulder Bag, Crossbody Bag, Backpack, Belt, Scarf

Respond ONLY with valid JSON, no other text.`,
          },
        ],
      }],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return null;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const productInfo = JSON.parse(jsonMatch[0]) as ProductInfo;
    const brand = productInfo.brand?.trim();
    const category = productInfo.category?.trim();
    const collection = productInfo.collection?.trim();
    const fullName =
      productInfo.fullName?.trim() || [brand, collection, category].filter(Boolean).join(" ");

    if (!brand || !category || !isValidResponse(brand)) {
      return null;
    }

    return {
      brand,
      collection,
      category,
      fullName,
    };
  } catch (error) {
    console.error(`   Error:`, error);
    return null;
  }
}

function resolveImageUrl(url: string): string | null {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/api/image?url=")) {
    try {
      return decodeURIComponent(url.split("url=")[1]);
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
  } catch {
    return null;
  }
}

function isValidResponse(text: string): boolean {
  const invalidPatterns = [
    /I don't see/i, /I can't/i, /I cannot/i, /unable to/i,
    /I'm sorry/i, /could you/i, /please/i,
  ];
  return !invalidPatterns.some((pattern) => pattern.test(text));
}

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

type CategoryResult = {
  id: string;
  slug: string;
};

async function getOrCreateCategory(name: string, parent?: CategoryResult): Promise<CategoryResult> {
  const baseSlug = slugify(name || "category");
  const slug = parent ? `${parent.slug}-${baseSlug}` : baseSlug;

  let category = await prisma.category.findUnique({ where: { slug } });

  if (!category) {
    category = await prisma.category.create({
      data: {
        nameEn: name,
        slug,
        parentId: parent?.id,
        status: "ACTIVE",
      },
    });
    console.log(`   📁 Created category: ${name}`);
  }

  return { id: category.id, slug: category.slug };
}

async function categorizeProducts() {
  console.log("\n🏷️  开始识别产品品牌和类别...\n");

  // 分批处理，每次10个
  const batchSize = 10;
  let offset = 0;
  let totalSuccess = 0;
  let totalFail = 0;

  while (true) {
    console.log(`\n正在获取第 ${offset + 1}-${offset + batchSize} 个产品...`);

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        qaStatus: "APPROVED",
        titleEn: "Designer Bag",
      },
      take: batchSize,
      skip: offset,
    });

    if (products.length === 0) {
      console.log("\n所有产品处理完成！");
      break;
    }

    console.log(`找到 ${products.length} 个产品\n`);

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      console.log(`[${offset + i + 1}] ${product.slug}`);

      const images = await prisma.productImage.findMany({
        where: { productId: product.id },
        take: 1,
      });

      if (!images[0]) {
        console.log(`   ⚠️  无图片，跳过`);
        totalFail++;
        continue;
      }

      const productInfo = await identifyProductDetails(images[0].url);

      if (productInfo) {
        const brandCategory = useBrandHierarchy
          ? await getOrCreateCategory(productInfo.brand)
          : null;
        const productCategory = await getOrCreateCategory(
          productInfo.category,
          brandCategory ?? undefined,
        );

        await prisma.product.update({
          where: { id: product.id },
          data: {
            titleEn: productInfo.fullName,
            categoryId: productCategory.id,
            tags: [productInfo.brand, productInfo.category]
              .map((tag) => tag.toLowerCase())
              .filter(Boolean),
          },
        });

        console.log(`   ✅ ${productInfo.brand} - ${productInfo.category}`);
        totalSuccess++;
      } else {
        console.log(`   ❌ 识别失败`);
        totalFail++;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    offset += batchSize;
  }

  console.log(`\n✅ 完成！成功: ${totalSuccess}, 失败: ${totalFail}\n`);
  await prisma.$disconnect();
}

categorizeProducts();
