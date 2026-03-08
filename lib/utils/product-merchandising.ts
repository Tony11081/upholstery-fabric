import type { PrismaClient } from "@prisma/client";
import { getBrandInfo } from "@/lib/utils/brands";
import { buildImportDescriptionEn } from "@/lib/utils/import-content";
import {
  classifyImportedProduct,
  ensureCategoryPath,
  type EnsuredCategoryPath,
  type ImportClassificationInput,
  type ImportClassificationResult,
} from "@/lib/utils/import-classifier";
import {
  colorToTag,
  extractColorOptionsFromText,
  extractColorsFromTags,
  extractMaterialOptionsFromText,
  extractMaterialsFromTags,
  extractSizeOptionsFromText,
  extractSizesFromTags,
  materialToTag,
  normalizeColorValues,
  normalizeMaterialValues,
  normalizeSizeValues,
  sizeToTag,
} from "@/lib/utils/product-options";

const TITLE_PLACEHOLDER_PATTERNS = [
  /^designer bag$/i,
  /^luxury item$/i,
  /^fashion item$/i,
  /^item$/i,
  /^new product$/i,
  /^test/i,
];

const SIZE_EXPECTED_CATEGORIES = new Set([
  "sneakers",
  "boots",
  "sandals",
  "heels",
  "loafers",
  "flats",
  "shoes",
  "dress",
  "top",
  "jacket",
  "coat",
  "skirt",
  "pants",
  "jeans",
  "apparel",
]);

function dedupeValues(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase().replace(/[\s_-]+/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function dedupeTags(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function titleNeedsNormalization(title: string | null | undefined, classification: ImportClassificationResult) {
  const normalized = (title ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return true;
  if (normalized.length < 20) return true;
  if (/[\u4e00-\u9fff]/.test(normalized)) return true;
  if (TITLE_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized))) return true;

  const lowered = normalized.toLowerCase();
  if (classification.brandLabel && !lowered.includes(classification.brandLabel.toLowerCase())) {
    return true;
  }
  return !lowered.includes(classification.categoryLabel.toLowerCase());
}

function descriptionNeedsNormalization(description: string | null | undefined) {
  const normalized = (description ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length < 120) return true;
  return /[\u4e00-\u9fff]/.test(normalized);
}

function categoryUsuallyHasSizes(categorySlug: string, sourceText: string) {
  if (SIZE_EXPECTED_CATEGORIES.has(categorySlug)) return true;
  return /\b(size|sizes|eu|eur|us|uk|it|fr|jp|cm|inch)\b|尺码|码数/i.test(sourceText);
}

export type ProductMerchandisingInput = ImportClassificationInput & {
  colors?: unknown;
  sizes?: unknown;
  materials?: unknown;
  variants?: unknown;
  preferExistingTitle?: boolean;
  preferExistingDescription?: boolean;
  currentCategorySlug?: string | null;
};

export type ProductMerchandisingResult = {
  titleEn: string;
  descriptionEn: string;
  tags: string[];
  colors: string[];
  sizes: string[];
  materials: string[];
  classification: ImportClassificationResult;
  signals: {
    missingCategory: boolean;
    missingBrandTag: boolean;
    missingColors: boolean;
    missingSizes: boolean;
    missingMaterials: boolean;
    weakTitle: boolean;
    weakDescription: boolean;
    needsAiPolish: boolean;
  };
};

export function buildProductMerchandising(input: ProductMerchandisingInput): ProductMerchandisingResult {
  const sourceTitle = (input.title ?? "").trim();
  const sourceDescription = (input.description ?? "").trim();
  const sourceTags = dedupeTags(input.tags ?? []);
  const sourceText = [sourceTitle, sourceDescription, ...sourceTags].filter(Boolean).join(" ");

  const colors = dedupeValues([
    ...extractColorsFromTags(sourceTags),
    ...normalizeColorValues(input.colors),
    ...normalizeColorValues(input.variants),
    ...extractColorOptionsFromText(sourceText),
  ]);
  const sizes = dedupeValues([
    ...extractSizesFromTags(sourceTags),
    ...normalizeSizeValues(input.sizes),
    ...normalizeSizeValues(input.variants),
    ...extractSizeOptionsFromText(sourceText),
  ]);
  const materials = dedupeValues([
    ...extractMaterialsFromTags(sourceTags),
    ...normalizeMaterialValues(input.materials),
    ...normalizeMaterialValues(input.variants),
    ...extractMaterialOptionsFromText(sourceText),
  ]);

  const optionTags = [
    ...colors.map((value) => colorToTag(value)).filter(Boolean),
    ...sizes.map((value) => sizeToTag(value)).filter(Boolean),
    ...materials.map((value) => materialToTag(value)).filter(Boolean),
  ];

  const classification = classifyImportedProduct({
    title: sourceTitle || input.aiFullName,
    description: sourceDescription,
    aiBrand: input.aiBrand,
    aiCategory: input.aiCategory,
    aiFullName: input.aiFullName,
    tags: [...sourceTags, ...optionTags],
  });
  const currentBrand = getBrandInfo({ tags: sourceTags, titleEn: sourceTitle });
  const weakTitle = titleNeedsNormalization(sourceTitle, classification);
  const weakDescription = descriptionNeedsNormalization(sourceDescription);
  const titleEn =
    input.preferExistingTitle && !weakTitle
      ? sourceTitle
      : classification.title;
  const descriptionEn =
    input.preferExistingDescription && !weakDescription
      ? sourceDescription
      : buildImportDescriptionEn({
          sourceDescription,
          title: titleEn,
          categoryLabel: classification.categoryLabel,
          colorOptions: colors,
          sizeOptions: sizes,
        });
  const tags = dedupeTags([...sourceTags, ...classification.tags, ...optionTags]);
  const needsAiPolish = weakTitle || weakDescription || colors.length === 0;
  const sizeExpected = categoryUsuallyHasSizes(classification.categorySlug, sourceText);

  return {
    titleEn,
    descriptionEn,
    tags,
    colors,
    sizes,
    materials,
    classification,
    signals: {
      missingCategory: !input.currentCategorySlug || input.currentCategorySlug !== classification.categorySlug,
      missingBrandTag: !currentBrand?.tag && Boolean(classification.brandTag),
      missingColors: colors.length === 0,
      missingSizes: sizeExpected && sizes.length === 0,
      missingMaterials: materials.length === 0,
      weakTitle,
      weakDescription,
      needsAiPolish,
    },
  };
}

export type PersistedCatalogRepair = ProductMerchandisingResult & {
  categoryPath: EnsuredCategoryPath;
  changed: boolean;
};

export async function repairPersistedProductCatalogData(
  prisma: PrismaClient,
  productId: string,
): Promise<PersistedCatalogRepair | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      titleEn: true,
      descriptionEn: true,
      tags: true,
      category: {
        select: {
          slug: true,
        },
      },
    },
  });

  if (!product) return null;

  const merchandising = buildProductMerchandising({
    title: product.titleEn,
    description: product.descriptionEn,
    tags: product.tags,
    preferExistingTitle: true,
    preferExistingDescription: true,
    currentCategorySlug: product.category?.slug ?? null,
  });
  const categoryPath = await ensureCategoryPath(prisma, merchandising.classification);
  const changed =
    product.titleEn !== merchandising.titleEn ||
    (product.descriptionEn ?? "") !== merchandising.descriptionEn ||
    product.category?.slug !== categoryPath.categorySlug ||
    JSON.stringify(product.tags) !== JSON.stringify(merchandising.tags);

  if (changed) {
    await prisma.product.update({
      where: { id: product.id },
      data: {
        titleEn: merchandising.titleEn,
        descriptionEn: merchandising.descriptionEn,
        tags: merchandising.tags,
        categoryId: categoryPath.categoryId,
      },
      select: { id: true },
    });
  }

  return {
    ...merchandising,
    categoryPath,
    changed,
  };
}
