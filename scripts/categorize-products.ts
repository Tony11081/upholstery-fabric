import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config();
dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();
const anthropicAuthToken = process.env.ANTHROPIC_AUTH_TOKEN ?? "";
const anthropicApiKey = process.env.ANTHROPIC_API_KEY ?? "";
const useAnthropic = Boolean(anthropicAuthToken || anthropicApiKey);

const openRouterApiKey = process.env.OPENROUTER_API_KEY ?? "";
if (!useAnthropic && !openRouterApiKey) {
  throw new Error("OPENROUTER_API_KEY or ANTHROPIC_AUTH_TOKEN is required");
}

const openai = useAnthropic
  ? null
  : new OpenAI({
      apiKey: openRouterApiKey,
      baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    });
const anthropic = useAnthropic
  ? new Anthropic({
      baseURL: process.env.ANTHROPIC_BASE_URL ?? undefined,
      apiKey: anthropicApiKey || undefined,
      authToken: anthropicAuthToken || undefined,
    })
  : null;

const model = useAnthropic
  ? process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest"
  : process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
const batchLimit = Number(process.env.AI_BATCH_LIMIT ?? 0);
const batchOffset = Number(process.env.AI_BATCH_OFFSET ?? 0);
const itemDelayMs = Number(process.env.AI_ITEM_DELAY_MS ?? 3000);
const maxRetries = Number(process.env.AI_MAX_RETRIES ?? 4);
const retryBaseMs = Number(process.env.AI_RETRY_BASE_MS ?? 2000);
const imageMode = (process.env.AI_IMAGE_MODE ?? "url").toLowerCase();
const imageDetail = process.env.AI_IMAGE_DETAIL ?? "low";
const concurrency = Math.max(1, Number(process.env.AI_CONCURRENCY ?? 3));
const forceDescription = (process.env.AI_DESCRIPTION_FORCE ?? "false").toLowerCase() === "true";
const logEvery = Math.max(1, Number(process.env.AI_LOG_EVERY ?? 25));
const shardCount = Math.max(1, Number(process.env.AI_SHARD_COUNT ?? 1));
const shardIndex = Math.max(0, Number(process.env.AI_SHARD_INDEX ?? 0));
const titlePrefixes = (process.env.AI_TITLE_PREFIXES ?? "Designer Bag|Luxury Bag #|Unknown")
  .split("|")
  .map((value) => value.trim())
  .filter(Boolean);
const categoryMode = (process.env.AI_CATEGORY_MODE ?? "flat").toLowerCase();
const useBrandHierarchy = categoryMode === "brand" || categoryMode === "hierarchy";

interface ProductInfo {
  brand: string;
  collection?: string;
  category: string;
  fullName: string;
  description?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorStatus(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const status = (error as { status?: number }).status;
  if (typeof status === "number") return status;
  const code = (error as { code?: number }).code;
  return typeof code === "number" ? code : null;
}

async function withRetry<T>(task: () => Promise<T>) {
  let attempt = 0;
  while (true) {
    try {
      return await task();
    } catch (error) {
      const status = getErrorStatus(error);
      const retryable = status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
      if (!retryable || attempt >= maxRetries) {
        throw error;
      }
      const delay = retryBaseMs * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
      console.log(`   ⏳ Rate limited (status ${status ?? "unknown"}), retrying in ${delay}ms...`);
      await sleep(delay);
      attempt += 1;
    }
  }
}

async function identifyProductDetails(imageUrl: string): Promise<ProductInfo | null> {
  try {
    const prompt = `Identify this luxury product and return the information in this exact JSON format:
{
  "brand": "Brand Name",
  "collection": "Model/Collection name (short, empty if unknown)",
  "category": "Product Type",
  "fullName": "Brand + Collection/Model + Product Type",
  "description": "1-2 sentence premium product description"
}

Rules:
- Always include brand and category.
- If collection is unknown, set it to an empty string.
- fullName should be "Brand Collection Category" or "Brand Category" if collection is empty.
- Description should be enticing, clear, and accurate. No bullet points, no emojis.
- Mention materials or features only if they are visible or obvious.
- Do NOT guess sizes or measurements. Only include dimensions if explicitly visible in the image or text.

Brand examples: Louis Vuitton, Gucci, Chanel, Hermes, Prada, Dior, Fendi, Balenciaga, Bottega Veneta, Celine
Category examples: Handbag, Wallet, Card Holder, Clutch, Tote Bag, Shoulder Bag, Crossbody Bag, Backpack, Belt, Scarf

Respond ONLY with valid JSON, no other text.`;

    if (useAnthropic && anthropic) {
      const resolvedUrl = resolveImageUrl(imageUrl);
      if (!resolvedUrl) return null;

      const base64Image = await downloadImageAsBase64(resolvedUrl);
      if (!base64Image) return null;
      const parsed = parseDataUrl(base64Image);
      if (!parsed) return null;

      const response = await withRetry(() =>
        anthropic.messages.create({
          model,
          max_tokens: 300,
          messages: [{
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: parsed.mediaType,
                  data: parsed.data,
                },
              },
              { type: "text", text: prompt },
            ],
          }],
        }),
      );

      const content = response.content?.find((block) => block.type === "text")?.text?.trim();
      if (!content) return null;

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const productInfo = JSON.parse(jsonMatch[0]) as ProductInfo;
      const brand = productInfo.brand?.trim();
      const category = productInfo.category?.trim();
      const collection = productInfo.collection?.trim();
      const fullName =
        productInfo.fullName?.trim() || [brand, collection, category].filter(Boolean).join(" ");
      const description = productInfo.description?.trim();

      if (!brand || !category || !isValidResponse(brand)) {
        return null;
      }

      return {
        brand,
        collection,
        category,
        fullName,
        description,
      };
    }

    const imageContent = await buildImageContent(imageUrl);
    if (!imageContent || !openai) return null;

    const response = await withRetry(() =>
      openai.chat.completions.create({
        model,
        max_tokens: 300,
        messages: [{
          role: "user",
          content: [
            imageContent,
            {
              type: "text",
              text: prompt,
            },
          ],
        }],
      }),
    );

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
    const description = productInfo.description?.trim();

    if (!brand || !category || !isValidResponse(brand)) {
      return null;
    }

    return {
      brand,
      collection,
      category,
      fullName,
      description,
    };
  } catch (error) {
    console.error(`   Error:`, error);
    return null;
  }
}

async function buildImageContent(imageUrl: string) {
  const resolvedUrl = resolveImageUrl(imageUrl);
  if (!resolvedUrl) return null;

  if (imageMode !== "base64") {
    return { type: "image_url", image_url: { url: resolvedUrl, detail: imageDetail } } as const;
  }

  const base64Image = await downloadImageAsBase64(resolvedUrl);
  if (!base64Image) return null;
  return { type: "image_url", image_url: { url: base64Image, detail: imageDetail } } as const;
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

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) return null;
  return { mediaType: match[1], data: match[2] };
}

function pickImageUrl(images: Array<{ url: string | null }>) {
  for (const image of images) {
    if (!image?.url) continue;
    const resolved = resolveImageUrl(image.url);
    if (!resolved) continue;
    if (resolved.includes("default_theme_addCart")) continue;
    return resolved;
  }
  return null;
}

function shouldUpdateDescription(description: string | null | undefined) {
  if (forceDescription) return true;
  if (!description) return true;
  const trimmed = description.trim();
  return trimmed.length < 20;
}

async function runWithConcurrency<T>(
  items: T[],
  handler: (item: T, index: number, total: number) => Promise<void>,
  limit: number,
) {
  const total = items.length;
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, total) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= total) return;
      await handler(items[index], index, total);
    }
  });
  await Promise.all(workers);
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
    try {
      category = await prisma.category.create({
        data: {
          nameEn: name,
          slug,
          parentId: parent?.id,
          status: "ACTIVE",
        },
      });
      console.log(`   📁 Created category: ${name}`);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "P2002") {
        throw error;
      }
      category = await prisma.category.findUnique({ where: { slug } });
      if (!category) {
        throw error;
      }
    }
  }

  return { id: category.id, slug: category.slug };
}

async function categorizeProducts() {
  console.log("\n🏷️  开始识别产品品牌和类别...\n");
  console.log("正在查询数据库...");

  const titleFilters = titlePrefixes.map((prefix) => ({ titleEn: { startsWith: prefix } }));
  if (shardIndex >= shardCount) {
    throw new Error(`AI_SHARD_INDEX (${shardIndex}) must be < AI_SHARD_COUNT (${shardCount})`);
  }

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      qaStatus: "APPROVED",
      OR: [
        ...titleFilters,
        { tags: { isEmpty: true } },
        { categoryId: null },
      ],
    },
    select: {
      id: true,
      slug: true,
      titleEn: true,
      descriptionEn: true,
    },
    orderBy: { createdAt: "desc" },
    ...(batchOffset > 0 ? { skip: batchOffset } : {}),
    ...(batchLimit > 0 ? { take: batchLimit } : {}),
  });

  const shardedProducts =
    shardCount > 1 ? products.filter((_, index) => index % shardCount === shardIndex) : products;
  const shardSuffix = shardCount > 1 ? ` (shard ${shardIndex + 1}/${shardCount})` : "";
  console.log(`找到 ${shardedProducts.length} 个未分类产品${shardSuffix}\n`);

  let successCount = 0;
  let failCount = 0;

  await runWithConcurrency(
    shardedProducts,
    async (product, index, total) => {
      try {
        const logProgress = logEvery <= 1 || index % logEvery === 0 || index === total - 1;
        if (logProgress) {
          console.log(`[${index + 1}/${total}] ${product.slug}`);
        }

        const images = await prisma.productImage.findMany({
          where: { productId: product.id },
          orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
          take: 5,
        });

        const imageUrl = pickImageUrl(images);
        if (!imageUrl) {
          if (logProgress) {
            console.log(`   ⚠️  无图片，跳过`);
          }
          failCount++;
          return;
        }

        const productInfo = await identifyProductDetails(imageUrl);

        if (productInfo) {
          const brandCategory = useBrandHierarchy
            ? await getOrCreateCategory(productInfo.brand)
            : null;
          const productCategory = await getOrCreateCategory(
            productInfo.category,
            brandCategory ?? undefined,
          );
          const descriptionEn =
            productInfo.description && shouldUpdateDescription(product.descriptionEn)
              ? productInfo.description
              : undefined;

          await prisma.product.update({
            where: { id: product.id },
            data: {
              titleEn: productInfo.fullName,
              categoryId: productCategory.id,
              ...(descriptionEn ? { descriptionEn } : {}),
              tags: [productInfo.brand, productInfo.category]
                .map((tag) => slugify(tag))
                .filter(Boolean),
            },
          });

          if (logProgress) {
            console.log(`   ✅ ${productInfo.brand} - ${productInfo.category}`);
          }
          successCount++;
        } else {
          if (logProgress) {
            console.log(`   ❌ 识别失败`);
          }
          failCount++;
        }
      } catch (error) {
        console.error(`   Error:`, error);
        failCount++;
      } finally {
        if (itemDelayMs > 0) {
          await sleep(itemDelayMs);
        }
      }
    },
    concurrency,
  );

  console.log(`\n✅ 完成！成功: ${successCount}, 失败: ${failCount}\n`);
  await prisma.$disconnect();
}

categorizeProducts();
