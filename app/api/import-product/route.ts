import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils/slug';
import { inferProductOptionsWithAI } from '@/lib/ai/product-options';
import { buildProductMerchandising } from '@/lib/utils/product-merchandising';
import { ensureCategoryPath } from '@/lib/utils/import-classifier';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

type ImportBody = {
  images?: unknown;
  price?: unknown;
  title?: unknown;
  description?: unknown;
  tags?: unknown;
  colors?: unknown;
  colorOptions?: unknown;
  sizes?: unknown;
  sizeOptions?: unknown;
  variants?: unknown;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((tag) => normalizeText(tag)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[|,]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [] as string[];
}

function generateSlug(title: string, id: string): string {
  const base = slugify(title);
  const suffix = slugify(String(id ?? ""));
  if (!base) return suffix;
  if (!suffix) return base;
  return `${base}-${suffix}`;
}

// 品牌官网参考价格 (USD)
const BRAND_RETAIL_PRICES: Record<string, number> = {
  'Chanel': 5000, 'Louis Vuitton': 3000, 'Gucci': 2500, 'Prada': 2800,
  'Dior': 4000, 'Hermes': 10000, 'YSL': 2200, 'Burberry': 1800,
  'Fendi': 2500, 'Celine': 3000, 'Balenciaga': 2000, 'Bottega Veneta': 3500,
  'Coach': 500, 'Loewe': 2800, 'Miu Miu': 1800, 'Versace': 2000,
  'Givenchy': 2200, 'Valentino': 2500,
};

// 计算售价: 人民币×1.2=美元, 最高450, 最低95
function calculatePrice(cnyPrice: number | null, brand: string | null): number {
  if (cnyPrice && cnyPrice > 0) {
    return Math.min(450, Math.round(cnyPrice * 1.2));
  }
  const retailPrice = brand ? BRAND_RETAIL_PRICES[brand] || 2000 : 2000;
  return Math.min(450, Math.max(95, Math.round(retailPrice * 0.15)));
}

export async function POST(request: NextRequest) {
  try {
    const data = (await request.json()) as ImportBody;
    const images = Array.isArray(data.images)
      ? data.images.filter((url): url is string => typeof url === "string" && url.trim().length > 0)
      : [];
    const price = data.price;
    const title = normalizeText(data.title);
    const description = normalizeText(data.description);
    const tags = data.tags;

    if (!images || images.length === 0) {
      return NextResponse.json({ error: 'Missing images' }, { status: 400, headers: corsHeaders });
    }

    const sourceTitle = title;
    const sourceDescription = description;
    const sourceTags = normalizeTags(tags);
    const initialMerchandising = buildProductMerchandising({
      title: sourceTitle,
      description: sourceDescription,
      tags: sourceTags,
      colors: [data.colors, data.colorOptions, data.variants],
      sizes: [data.sizes, data.sizeOptions, data.variants],
      materials: data.variants,
      variants: data.variants,
    });

    const aiEnabled = process.env.AI_IMPORT_ENABLED !== "false";
    let aiColors: string[] = [];
    let aiSizes: string[] = [];
    if (aiEnabled) {
      const inferred = await inferProductOptionsWithAI({
        imageUrl: images[0],
        title: sourceTitle,
        description: sourceDescription,
        candidateColors: initialMerchandising.colors,
        candidateSizes: initialMerchandising.sizes,
      });
      aiColors = inferred.colors;
      aiSizes = inferred.sizes;
    }

    const merchandising = buildProductMerchandising({
      title: sourceTitle,
      description: sourceDescription,
      tags: sourceTags,
      colors: [...initialMerchandising.colors, ...aiColors],
      sizes: [...initialMerchandising.sizes, ...aiSizes],
      materials: data.variants,
      variants: data.variants,
    });
    const categoryPath = await ensureCategoryPath(prisma, merchandising.classification);

    // Generate product data - 自动分类并生成标题
    const titleEn = merchandising.titleEn;
    const productId = Date.now().toString();
    const slug = generateSlug(titleEn, productId);

    // 计算美元售价
    const normalizedPrice =
      typeof price === "string" ? Number(price) : typeof price === "number" ? price : null;
    const usdPrice = calculatePrice(normalizedPrice, merchandising.classification.brandLabel);
    const descriptionEn = merchandising.descriptionEn;

    // Check duplicate
    const existing = await prisma.product.findFirst({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: 'Product already exists', slug }, { status: 409, headers: corsHeaders });
    }

    // Create product
    const product = await prisma.product.create({
      data: {
        titleEn: titleEn,
        slug: slug,
        descriptionEn: descriptionEn,
        price: usdPrice,
        currency: 'USD',
        inventory: 10,
        tags: merchandising.tags,
        categoryId: categoryPath.categoryId,
        isNew: true,
        isActive: true,
      }
    });

    // Add images (最多保留10张，使用代理URL隐藏来源)
    if (images && images.length > 0) {
      const limitedImages = images.slice(0, 10);
      for (let i = 0; i < limitedImages.length; i++) {
        // 将原始URL转换为代理URL
        const proxyUrl = `/api/image?url=${encodeURIComponent(limitedImages[i])}`;
        await prisma.productImage.create({
          data: {
            productId: product.id,
            url: proxyUrl,
            sortOrder: i,
            isCover: i === 0
          }
        });
      }
    }

    return NextResponse.json({
      success: true,
      productId: product.id,
      slug,
      category: categoryPath.categorySlug,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Import error:', error);
    const message = error instanceof Error ? error.message : 'Import failed';
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
