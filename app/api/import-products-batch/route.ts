import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withRetry } from '@/lib/db-retry';
import { syncProductsToRemote } from '@/lib/sync-remote';
import { normalizeTitleFromSource } from '@/lib/utils/product-title';
import { ensureCategoryPath } from '@/lib/utils/import-classifier';
import { isAiChatConfigured, openRouterChat } from '@/lib/ai/openrouter';
import { inferProductOptionsWithAI } from '@/lib/ai/product-options';
import { buildProductMerchandising } from '@/lib/utils/product-merchandising';
import {
  extractColorOptionsFromText,
  extractSizeOptionsFromText,
  normalizeColorValues,
  normalizeSizeValues,
} from '@/lib/utils/product-options';

interface ProductInfo {
  brand: string;
  collection?: string;
  category: string;
  fullName: string;
}

type BatchImportItem = {
  images?: string[];
  price?: number | string;
  title?: string;
  description?: string;
  sourceUrl?: string;
  tags?: string[] | string;
  brand?: string;
  category?: string;
  fullName?: string;
  colors?: unknown;
  colorOptions?: unknown;
  sizes?: unknown;
  sizeOptions?: unknown;
  variants?: unknown;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((tag) => normalizeText(tag))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[|,]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [] as string[];
}

function dedupeValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function generateSlug(title: string, id: string): string {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${id}`.replace(/^-|-$/g, '');
}

// 计算售价: 人民币×1.2=美元, 最高450, 最低95
function calculatePrice(cnyPrice: number | null): number {
  if (cnyPrice && cnyPrice > 0) {
    return Math.min(450, Math.max(95, Math.round(cnyPrice * 1.2)));
  }
  return 150; // 默认价格
}

// 图像识别函数
async function identifyProduct(imageUrl: string): Promise<ProductInfo | null> {
  try {
    // 下载图片并转为 base64
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const base64Image = `data:${contentType};base64,${base64}`;

    const content = await openRouterChat({
      model: process.env.AI_IMAGE_MODEL,
      maxTokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: base64Image } },
          {
            type: 'text',
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
    if (!content) return null;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const productInfo = JSON.parse(jsonMatch[0]) as ProductInfo;
    const brand = productInfo.brand?.trim();
    const category = productInfo.category?.trim();
    const collection = productInfo.collection?.trim();
    const fullName =
      productInfo.fullName?.trim() || [brand, collection, category].filter(Boolean).join(" ");
    if (!brand || !category) return null;

    return {
      brand,
      collection,
      category,
      fullName,
    };
  } catch (error) {
    console.error('识别失败:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { products?: BatchImportItem[]; enableAI?: boolean };
    const products = body.products;
    const aiRequested = body.enableAI !== false;
    const enableAI = aiRequested && isAiChatConfigured();

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'Missing products array' }, { status: 400, headers: corsHeaders });
    }
    if (aiRequested && !enableAI) {
      console.warn("[import-products-batch] AI requested but provider is not configured. Falling back to rule-based extraction.");
    }

    // 暂时禁用去重，因为无法匹配本地路径和原始URL
    const existingUrls = new Set<string>();
    const categoryStats = new Map<string, number>();

    // 预处理：过滤重复和无效产品，并进行图像识别
    const validProducts: {
      images: string[];
      price: number;
      slug: string;
      title: string;
      description?: string;
      tags: string[];
      categoryId: string;
      categorySlug: string;
      categoryLabel: string;
      sourceUrl?: string;
    }[] = [];
    let skipped = 0;
    let failed = 0;

    // 并行识别所有产品（最多5个并发）
    const BATCH_SIZE = 5;
    const pendingItems: {
      images: string[];
      price: number;
      title?: string;
      description?: string;
      sourceUrl?: string;
      tags: string[];
      brand?: string;
      category?: string;
      fullName?: string;
      colorOptions: string[];
      sizeOptions: string[];
      variants?: unknown;
    }[] = [];

    for (const item of products) {
      const images = Array.isArray(item?.images)
        ? item.images.filter((url): url is string => typeof url === "string" && url.trim().length > 0)
        : [];
      const price = item?.price;
      const title = normalizeText(item?.title);
      const description = normalizeText(item?.description);
      const sourceUrl = normalizeText(item?.sourceUrl);
      const tags = normalizeTags(item?.tags);
      const brand = normalizeText(item?.brand);
      const category = normalizeText(item?.category);
      const fullName = normalizeText(item?.fullName);
      const sourceText = [title, description, ...tags].filter(Boolean).join(" ");
      const colorOptions = dedupeValues([
        ...normalizeColorValues(item?.colors),
        ...normalizeColorValues(item?.colorOptions),
        ...normalizeColorValues(item?.variants),
        ...extractColorOptionsFromText(sourceText),
      ]);
      const sizeOptions = dedupeValues([
        ...normalizeSizeValues(item?.sizes),
        ...normalizeSizeValues(item?.sizeOptions),
        ...normalizeSizeValues(item?.variants),
        ...extractSizeOptionsFromText(sourceText),
      ]);

      if (!images || images.length === 0) {
        failed++;
        continue;
      }
      const normalizedPrice =
        typeof price === "string" ? Number(price) : typeof price === "number" ? price : null;
      if (!normalizedPrice || !Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
        skipped++;
        continue;
      }
      if (existingUrls.has(images[0])) {
        skipped++;
        continue;
      }
      existingUrls.add(images[0]);
      pendingItems.push({
        images: images.slice(0, 10),
        price: normalizedPrice,
        title: title || undefined,
        description: description || undefined,
        sourceUrl: sourceUrl || undefined,
        tags,
        brand: brand || undefined,
        category: category || undefined,
        fullName: fullName || undefined,
        colorOptions,
        sizeOptions,
        variants: item?.variants,
      });
    }

    // 分批识别（仅在 enableAI=true 时）
    for (let i = 0; i < pendingItems.length; i += BATCH_SIZE) {
      const batch = pendingItems.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(async (item) => {
        const imageUrl = item.images[0];
        const sourceTitle = typeof item.title === "string" ? item.title.trim() : "";
        const sourceDescription = typeof item.description === "string" ? item.description.trim() : "";
        const sourceTags = normalizeTags(item.tags);
        const sourceBrand = normalizeText(item.brand);
        const sourceCategory = normalizeText(item.category);
        const sourceFullName = normalizeText(item.fullName);
        const sourceText = [sourceTitle, sourceDescription].filter(Boolean).join(" ");
        const normalizedFromSource = sourceText
          ? normalizeTitleFromSource(sourceText, { fallbackCategory: "Accessories" })
          : null;
        const initialMerchandising = buildProductMerchandising({
          title: sourceTitle || sourceFullName,
          description: sourceDescription,
          tags: sourceTags,
          colors: item.colorOptions,
          sizes: item.sizeOptions,
          materials: item.variants,
          variants: item.variants,
          aiBrand: sourceBrand,
          aiCategory: sourceCategory,
          aiFullName: sourceFullName,
        });
        let productInfo: ProductInfo | null = null;
        let aiOptionColors: string[] = [];
        let aiOptionSizes: string[] = [];

        // 默认先走规则分类，规则识别不出品牌或类别时再用 AI 兜底
        if (enableAI && (!normalizedFromSource?.category || !normalizedFromSource?.brand)) {
          productInfo = await identifyProduct(imageUrl);
        }
        if (enableAI) {
          const inferred = await inferProductOptionsWithAI({
            imageUrl,
            title: sourceTitle,
            description: sourceDescription,
            candidateColors: initialMerchandising.colors,
            candidateSizes: initialMerchandising.sizes,
          });
          aiOptionColors = inferred.colors;
          aiOptionSizes = inferred.sizes;
        }

        const merchandising = buildProductMerchandising({
          title: sourceTitle || sourceFullName || productInfo?.fullName,
          description: sourceDescription,
          aiBrand: productInfo?.brand || sourceBrand,
          aiCategory: productInfo?.category || sourceCategory,
          aiFullName: productInfo?.fullName || sourceFullName,
          tags: sourceTags,
          colors: [...initialMerchandising.colors, ...aiOptionColors],
          sizes: [...initialMerchandising.sizes, ...aiOptionSizes],
          materials: item.variants,
          variants: item.variants,
        });
        const categoryPath = await withRetry(() => ensureCategoryPath(prisma, merchandising.classification));
        const descriptionEn = merchandising.descriptionEn;
        categoryStats.set(
          categoryPath.categorySlug,
          (categoryStats.get(categoryPath.categorySlug) ?? 0) + 1,
        );

        const productId = Date.now().toString() + Math.random().toString(36).slice(2, 6);
        return {
          images: item.images,
          price: calculatePrice(item.price),
          slug: generateSlug(merchandising.titleEn || normalizedFromSource?.title || sourceTitle || "Luxury item", productId),
          title: merchandising.titleEn,
          description: descriptionEn,
          tags: merchandising.tags,
          categoryId: categoryPath.categoryId,
          categorySlug: categoryPath.categorySlug,
          categoryLabel: categoryPath.categoryLabel,
          sourceUrl: item.sourceUrl,
        };
      }));
      validProducts.push(...results);
    }

    // 使用真正的批量插入（一条SQL语句插入多个产品）
    const productDataToInsert = validProducts.map((p) => {
      const sourceNote = p.sourceUrl ? `Source: ${p.sourceUrl}` : null;
      return {
        titleEn: p.title,
        slug: p.slug,
        descriptionEn: p.description || '',
        price: p.price,
        currency: 'USD',
        inventory: 10,
        tags: p.tags,
        categoryId: p.categoryId,
        isNew: true,
        isActive: true,
        qualityNotes: sourceNote,
      };
    });

    // 使用 createManyAndReturn 一次性插入所有产品（需要 Prisma 5.15+）
    const createdProducts = await withRetry(() => prisma.product.createManyAndReturn({
      data: productDataToInsert
    }));

    // 保存图片URL（使用代理格式）
    const allImageData: Array<{
      productId: string;
      url: string;
      sortOrder: number;
      isCover: boolean;
    }> = [];
    for (let idx = 0; idx < createdProducts.length; idx++) {
      const product = createdProducts[idx];
      const productData = validProducts[idx];

      for (let i = 0; i < productData.images.length; i++) {
        const originalUrl = productData.images[i];
        // 使用代理API格式：/api/image?url=原始URL
        const proxyUrl = `/api/image?url=${encodeURIComponent(originalUrl)}`;

        allImageData.push({
          productId: product.id,
          url: proxyUrl,
          sortOrder: i,
          isCover: i === 0
        });
      }
    }

    if (allImageData.length > 0) {
      await withRetry(() => prisma.productImage.createMany({ data: allImageData }));
    }

    // 自动同步到远程数据库(后台执行,不阻塞响应)
    const productIdsToSync = createdProducts.map(p => p.id);
    syncProductsToRemote(productIdsToSync)
      .then(result => {
        console.log(`[sync] Remote sync completed: ${result.synced} synced, ${result.failed} failed`);
      })
      .catch(err => {
        console.error('[sync] Remote sync error:', err);
      });

    return NextResponse.json({
      success: true,
      total: products.length,
      imported: createdProducts.length,
      skipped,
      failed,
      categories: Object.fromEntries(
        Array.from(categoryStats.entries()).sort((a, b) => b[1] - a[1]),
      ),
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Batch import error:', error);
    return NextResponse.json({ error: 'Batch import failed' }, { status: 500, headers: corsHeaders });
  }
}
