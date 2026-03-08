import type { PrismaClient } from "@prisma/client";
import { getBrandInfo } from "@/lib/utils/brands";
import { normalizeTitleFromSource } from "@/lib/utils/product-title";
import { slugify } from "@/lib/utils/slug";

type CanonicalCategoryRule = {
  label: string;
  slug: string;
  parentLabel?: string;
  parentSlug?: string;
  aliases?: string[];
};

const CANONICAL_CATEGORY_RULES: CanonicalCategoryRule[] = [
  { label: "Bags", slug: "bags", aliases: ["bag"] },
  { label: "Handbag", slug: "handbag", parentLabel: "Bags", parentSlug: "bags", aliases: ["vanity-case", "cosmetic-case"] },
  { label: "Shoulder Bag", slug: "shoulder-bag", parentLabel: "Bags", parentSlug: "bags" },
  { label: "Crossbody Bag", slug: "crossbody-bag", parentLabel: "Bags", parentSlug: "bags", aliases: ["crossbody-bag-set"] },
  { label: "Tote Bag", slug: "tote-bag", parentLabel: "Bags", parentSlug: "bags" },
  { label: "Bucket Bag", slug: "bucket-bag", parentLabel: "Bags", parentSlug: "bags" },
  { label: "Backpack", slug: "backpack", parentLabel: "Bags", parentSlug: "bags" },
  { label: "Clutch", slug: "clutch", parentLabel: "Bags", parentSlug: "bags" },
  { label: "Travel Bag", slug: "travel-bag", parentLabel: "Bags", parentSlug: "bags", aliases: ["duffle-bag", "weekender"] },
  { label: "Wallet", slug: "wallet", parentLabel: "Accessories", parentSlug: "accessories", aliases: ["wallet-on-chain"] },
  { label: "Card Holder", slug: "card-holder", parentLabel: "Accessories", parentSlug: "accessories", aliases: ["key-pouch", "card-case"] },
  { label: "Belt Bag", slug: "belt-bag", parentLabel: "Bags", parentSlug: "bags" },
  { label: "Accessories", slug: "accessories" },
  { label: "Belt", slug: "belt", parentLabel: "Accessories", parentSlug: "accessories" },
  { label: "Scarf", slug: "scarf", parentLabel: "Accessories", parentSlug: "accessories" },
  { label: "Sunglasses", slug: "sunglasses", parentLabel: "Accessories", parentSlug: "accessories", aliases: ["eyeglasses"] },
  { label: "Hat", slug: "hat", parentLabel: "Accessories", parentSlug: "accessories" },
  { label: "Shoes", slug: "shoes" },
  { label: "Sneakers", slug: "sneakers", parentLabel: "Shoes", parentSlug: "shoes" },
  { label: "Boots", slug: "boots", parentLabel: "Shoes", parentSlug: "shoes" },
  { label: "Sandals", slug: "sandals", parentLabel: "Shoes", parentSlug: "shoes" },
  { label: "Heels", slug: "heels", parentLabel: "Shoes", parentSlug: "shoes" },
  { label: "Loafers", slug: "loafers", parentLabel: "Shoes", parentSlug: "shoes", aliases: ["loafer"] },
  { label: "Flats", slug: "flats", parentLabel: "Shoes", parentSlug: "shoes", aliases: ["ballet-flat"] },
  { label: "Jewelry", slug: "jewelry" },
  { label: "Necklace", slug: "necklace", parentLabel: "Jewelry", parentSlug: "jewelry", aliases: ["pendant", "pendant-necklace"] },
  { label: "Earrings", slug: "earrings", parentLabel: "Jewelry", parentSlug: "jewelry", aliases: ["earring", "ear-cuff"] },
  { label: "Bracelet", slug: "bracelet", parentLabel: "Jewelry", parentSlug: "jewelry", aliases: ["bangle"] },
  { label: "Ring", slug: "ring", parentLabel: "Jewelry", parentSlug: "jewelry" },
  { label: "Brooch", slug: "brooch", parentLabel: "Jewelry", parentSlug: "jewelry" },
  { label: "Watch", slug: "watch", parentLabel: "Jewelry", parentSlug: "jewelry" },
  { label: "Home Decor", slug: "home-decor", aliases: ["glass"] },
  { label: "Apparel", slug: "apparel" },
  { label: "Dress", slug: "dress", parentLabel: "Apparel", parentSlug: "apparel" },
  { label: "Top", slug: "top", parentLabel: "Apparel", parentSlug: "apparel", aliases: ["shirt", "t-shirt", "blouse", "sweater", "hoodie"] },
  { label: "Jacket", slug: "jacket", parentLabel: "Apparel", parentSlug: "apparel", aliases: ["blazer"] },
  { label: "Coat", slug: "coat", parentLabel: "Apparel", parentSlug: "apparel" },
  { label: "Skirt", slug: "skirt", parentLabel: "Apparel", parentSlug: "apparel" },
  { label: "Pants", slug: "pants", parentLabel: "Apparel", parentSlug: "apparel", aliases: ["trousers", "leggings"] },
  { label: "Jeans", slug: "jeans", parentLabel: "Apparel", parentSlug: "apparel", aliases: ["denim-pants"] },
];

type CategoryRecord = {
  id: string;
  slug: string;
  nameEn: string;
  parentId: string | null;
  status: string;
};

const categoryBySlug = new Map(CANONICAL_CATEGORY_RULES.map((rule) => [rule.slug, rule]));
const categoryAliasMap = new Map<string, CanonicalCategoryRule>();
for (const rule of CANONICAL_CATEGORY_RULES) {
  const rawAliases = [rule.label, rule.slug, ...(rule.aliases ?? [])];
  for (const alias of rawAliases) {
    const key = slugify(alias);
    if (!key) continue;
    categoryAliasMap.set(key, rule);
  }
}

const fallbackCategory = categoryBySlug.get("accessories") ?? CANONICAL_CATEGORY_RULES[0];

const CATEGORY_KEYWORD_HINTS: Array<{ slug: string; re: RegExp }> = [
  { slug: "crossbody-bag", re: /(?:crossbody|斜挎包|斜挎)/i },
  { slug: "shoulder-bag", re: /(?:shoulder\s*bag|单肩包|单肩)/i },
  { slug: "tote-bag", re: /(?:tote|托特包|购物袋)/i },
  { slug: "bucket-bag", re: /(?:bucket\s*bag|水桶包)/i },
  { slug: "backpack", re: /(?:backpack|双肩包|背包)/i },
  { slug: "clutch", re: /(?:clutch|手拿包|晚宴包)/i },
  { slug: "wallet", re: /(?:wallet|钱夹|钱包|长夹|短夹)/i },
  { slug: "card-holder", re: /(?:card\s*holder|card\s*case|卡包|卡夹)/i },
  { slug: "belt-bag", re: /(?:belt\s*bag|fanny\s*pack|腰包)/i },
  { slug: "sneakers", re: /(?:sneaker|trainer|运动鞋|球鞋)/i },
  { slug: "boots", re: /(?:boots?|靴)/i },
  { slug: "sandals", re: /(?:sandals?|凉鞋)/i },
  { slug: "heels", re: /(?:heels?|pumps?|高跟鞋)/i },
  { slug: "loafers", re: /(?:loafer|乐福鞋)/i },
  { slug: "flats", re: /(?:ballet\s*flat|flats?|平底鞋)/i },
  { slug: "watch", re: /(?:watch|腕表|手表)/i },
  { slug: "necklace", re: /(?:necklace|项链|吊坠)/i },
  { slug: "earrings", re: /(?:earring|耳钉|耳环)/i },
  { slug: "bracelet", re: /(?:bracelet|bangle|手链|手镯)/i },
  { slug: "ring", re: /(?:ring|戒指)/i },
  { slug: "dress", re: /(?:dress|连衣裙|裙装)/i },
  { slug: "top", re: /(?:shirt|t-shirt|tee|blouse|sweater|hoodie|上衣|衬衫|针织衫)/i },
  { slug: "jacket", re: /(?:jacket|blazer|夹克|西装外套)/i },
  { slug: "coat", re: /(?:coat|大衣|风衣)/i },
  { slug: "skirt", re: /(?:skirt|半裙|短裙|长裙)/i },
  { slug: "pants", re: /(?:pants|trousers|leggings|裤子|长裤)/i },
  { slug: "jeans", re: /(?:jeans?|牛仔裤)/i },
  { slug: "sunglasses", re: /(?:sunglasses|eyewear|墨镜|太阳镜)/i },
  { slug: "belt", re: /(?:belt|皮带|腰带)/i },
  { slug: "scarf", re: /(?:scarf|shawl|围巾|披肩)/i },
];

function normalizeCategoryInput(raw?: string | null) {
  if (!raw) return "";
  const normalized = slugify(raw);
  if (!normalized) return "";
  if (categoryAliasMap.has(normalized)) return normalized;

  const segments = normalized.split("-");
  for (let index = 1; index < segments.length; index += 1) {
    const tail = segments.slice(index).join("-");
    if (categoryAliasMap.has(tail)) {
      return tail;
    }
  }

  return normalized;
}

function resolveCanonicalCategory(raw?: string | null) {
  const key = normalizeCategoryInput(raw);
  return categoryAliasMap.get(key) ?? fallbackCategory;
}

function inferCategoryFromText(raw?: string | null) {
  const text = toSafeTitle(raw);
  if (!text) return null;
  for (const hint of CATEGORY_KEYWORD_HINTS) {
    if (hint.re.test(text)) {
      return categoryBySlug.get(hint.slug) ?? null;
    }
  }
  return null;
}

function toSafeTitle(input?: string | null) {
  const normalized = (input ?? "").replace(/\s+/g, " ").trim();
  return normalized;
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripBrandAndCategory(title: string, brandLabel: string | null, categoryLabel: string) {
  let normalized = title;
  if (brandLabel) {
    normalized = normalized.replace(new RegExp(`\\b${escapeRegex(brandLabel)}\\b`, "ig"), " ");
  }
  normalized = normalized.replace(new RegExp(`\\b${escapeRegex(categoryLabel)}\\b`, "ig"), " ");
  return normalized.replace(/\s+/g, " ").trim();
}

function ensureTitleShape(params: {
  baseTitle: string;
  brandLabel: string | null;
  categoryLabel: string;
}) {
  const { baseTitle, brandLabel, categoryLabel } = params;
  const compact = baseTitle.replace(/\s+/g, " ").trim();
  if (!compact) return `${brandLabel ?? "Designer"} ${categoryLabel}`;

  const cleanCore = stripBrandAndCategory(compact, brandLabel, categoryLabel);
  const parts = [brandLabel ?? "Designer", cleanCore, categoryLabel].filter(Boolean);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function toSafeTag(input: string) {
  const tag = slugify(input);
  if (!tag || tag.length < 2) return null;
  return tag;
}

export type ImportClassificationInput = {
  title?: string | null;
  description?: string | null;
  aiBrand?: string | null;
  aiCategory?: string | null;
  aiFullName?: string | null;
  tags?: string[];
};

export type ImportClassificationResult = {
  title: string;
  brandLabel: string | null;
  brandTag: string | null;
  categoryLabel: string;
  categorySlug: string;
  parentCategoryLabel: string | null;
  parentCategorySlug: string | null;
  tags: string[];
};

export function classifyImportedProduct(input: ImportClassificationInput): ImportClassificationResult {
  const safeTitle = toSafeTitle(input.title);
  const safeDescription = toSafeTitle(input.description);
  const sourceText = [safeTitle, safeDescription, ...(input.tags ?? [])].filter(Boolean).join(" ");
  const inferredCategory = inferCategoryFromText([safeTitle, safeDescription, input.aiCategory].filter(Boolean).join(" "));

  const normalized = sourceText
    ? normalizeTitleFromSource(sourceText, { fallbackCategory: inferredCategory?.label ?? "Accessories" })
    : null;

  const canonicalCategory = resolveCanonicalCategory(
    normalized?.category ?? input.aiCategory ?? inferredCategory?.slug ?? inferredCategory?.label,
  );
  const tagCandidates = [
    ...(input.tags ?? []),
    normalized?.brand ?? "",
    input.aiBrand ?? "",
  ].filter(Boolean);
  const brandInfo = getBrandInfo({
    tags: tagCandidates,
    titleEn: [sourceText, input.aiBrand ?? ""].filter(Boolean).join(" "),
  });

  const inferredBrand = brandInfo?.label ?? normalized?.brand ?? toSafeTitle(input.aiBrand);
  const brandLabel = inferredBrand || null;
  const brandTag = brandInfo?.tag ?? (brandLabel ? toSafeTag(brandLabel) : null);
  const titleSeed =
    normalized?.title ||
    toSafeTitle(input.aiFullName) ||
    safeTitle;
  const title = ensureTitleShape({
    baseTitle: titleSeed,
    brandLabel,
    categoryLabel: canonicalCategory.label,
  });

  const tags = new Set<string>();
  if (brandTag) tags.add(brandTag);
  tags.add(canonicalCategory.slug);
  if (canonicalCategory.parentSlug) {
    tags.add(canonicalCategory.parentSlug);
  }
  for (const candidate of input.tags ?? []) {
    const tag = toSafeTag(candidate);
    if (!tag) continue;
    tags.add(tag);
  }

  return {
    title,
    brandLabel,
    brandTag,
    categoryLabel: canonicalCategory.label,
    categorySlug: canonicalCategory.slug,
    parentCategoryLabel: canonicalCategory.parentLabel ?? null,
    parentCategorySlug: canonicalCategory.parentSlug ?? null,
    tags: Array.from(tags),
  };
}

async function ensureCategoryRecord(
  prisma: PrismaClient,
  slug: string,
  nameEn: string,
  parentId: string | null,
): Promise<CategoryRecord> {
  let category = await prisma.category.findUnique({
    where: { slug },
  });

  if (!category) {
    try {
      category = await prisma.category.create({
        data: {
          slug,
          nameEn,
          parentId,
          status: "ACTIVE",
        },
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "P2002") {
        throw error;
      }
      category = await prisma.category.findUnique({ where: { slug } });
    }
  }

  if (!category) {
    throw new Error(`Failed to ensure category: ${slug}`);
  }

  const updates: { nameEn?: string; parentId?: string | null; status?: "ACTIVE" } = {};
  if (category.nameEn !== nameEn) updates.nameEn = nameEn;
  if ((category.parentId ?? null) !== parentId) updates.parentId = parentId;
  if (category.status !== "ACTIVE") updates.status = "ACTIVE";

  if (Object.keys(updates).length === 0) {
    return {
      id: category.id,
      slug: category.slug,
      nameEn: category.nameEn,
      parentId: category.parentId,
      status: category.status,
    };
  }

  const updated = await prisma.category.update({
    where: { id: category.id },
    data: updates,
  });

  return {
    id: updated.id,
    slug: updated.slug,
    nameEn: updated.nameEn,
    parentId: updated.parentId,
    status: updated.status,
  };
}

export type EnsuredCategoryPath = {
  categoryId: string;
  categorySlug: string;
  categoryLabel: string;
  parentCategoryId: string | null;
  parentCategorySlug: string | null;
};

export async function ensureCategoryPath(
  prisma: PrismaClient,
  classification: ImportClassificationResult,
): Promise<EnsuredCategoryPath> {
  let parentCategory: CategoryRecord | null = null;
  if (classification.parentCategorySlug && classification.parentCategoryLabel) {
    parentCategory = await ensureCategoryRecord(
      prisma,
      classification.parentCategorySlug,
      classification.parentCategoryLabel,
      null,
    );
  }

  const category = await ensureCategoryRecord(
    prisma,
    classification.categorySlug,
    classification.categoryLabel,
    parentCategory?.id ?? null,
  );

  return {
    categoryId: category.id,
    categorySlug: category.slug,
    categoryLabel: category.nameEn,
    parentCategoryId: parentCategory?.id ?? null,
    parentCategorySlug: parentCategory?.slug ?? null,
  };
}
