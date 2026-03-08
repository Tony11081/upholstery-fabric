import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { slugify } from "../lib/utils/slug";
import { normalizeTitleFromSource } from "../lib/utils/product-title";
import { getBrandInfo } from "../lib/utils/brands";

dotenv.config();
dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

const PLACEHOLDER_PREFIXES = ["Designer Bag", "Luxury Bag #", "Unknown"];
const APPLY = process.argv.includes("--apply");
const batchSize = Math.max(50, Number(process.env.CATALOG_BATCH_SIZE ?? 200));
const concurrency = Math.max(1, Number(process.env.CATALOG_CONCURRENCY ?? 6));

type CanonicalCategory = {
  label: string;
  aliases?: string[];
};

const CANONICAL_CATEGORIES: CanonicalCategory[] = [
  { label: "Bag", aliases: ["bags"] },
  { label: "Handbag", aliases: ["vanity-case", "cosmetic-case"] },
  { label: "Shoulder Bag" },
  { label: "Crossbody Bag", aliases: ["crossbody-bag-set"] },
  { label: "Tote Bag" },
  { label: "Bucket Bag" },
  { label: "Backpack" },
  { label: "Clutch" },
  { label: "Wallet", aliases: ["wallet-on-chain"] },
  { label: "Card Holder", aliases: ["key-pouch", "card-case"] },
  { label: "Belt Bag" },
  { label: "Belt" },
  { label: "Scarf" },
  { label: "Sunglasses", aliases: ["eyeglasses"] },
  { label: "Hat" },
  { label: "Shoes" },
  { label: "Sneakers" },
  { label: "Boots" },
  { label: "Sandals" },
  { label: "Heels" },
  { label: "Necklace", aliases: ["pendant", "pendant-necklace"] },
  { label: "Earrings", aliases: ["earring", "ear-cuff"] },
  { label: "Bracelet", aliases: ["bangle"] },
  { label: "Ring" },
  { label: "Brooch" },
  { label: "Watch" },
  { label: "Jewelry", aliases: ["jewelry-set"] },
  { label: "Accessories", aliases: ["bag-charm", "chain-strap", "jewelry-case", "hair-clip", "machinery"] },
  { label: "Home Decor", aliases: ["glass"] },
  { label: "Dress" },
  { label: "Apparel", aliases: ["t-shirt"] },
];

const TAG_DROP = new Set([
  "cart",
  "shopping-cart",
  "shopping-cart-icon",
  "product",
  "products",
  "others",
  "other",
  "unknown",
  "uncategorized",
  "aaa",
]);

const categoryAliasMap = new Map<string, string>();
for (const category of CANONICAL_CATEGORIES) {
  const slug = slugify(category.label);
  categoryAliasMap.set(slug, category.label);
  for (const alias of category.aliases ?? []) {
    categoryAliasMap.set(slugify(alias), category.label);
  }
}

function normalizeCategoryLabel(input?: string | null) {
  if (!input) return null;
  const key = slugify(input);
  return categoryAliasMap.get(key) ?? null;
}

function normalizeCategoryFromSlug(slug?: string | null) {
  if (!slug) return null;
  const normalized = slugify(slug);
  if (categoryAliasMap.has(normalized)) return categoryAliasMap.get(normalized) ?? null;
  for (const alias of categoryAliasMap.keys()) {
    if (normalized.endsWith(`-${alias}`)) {
      return categoryAliasMap.get(alias) ?? null;
    }
  }
  return null;
}

function extractBrandFromCategorySlug(slug?: string | null) {
  if (!slug) return null;
  const normalized = slugify(slug);
  for (const alias of categoryAliasMap.keys()) {
    if (normalized.endsWith(`-${alias}`)) {
      return normalized.slice(0, -(alias.length + 1));
    }
  }
  return null;
}

function normalizeTag(tag: string) {
  const trimmed = tag.trim();
  if (!trimmed) return null;
  const brandMatch = getBrandInfo({ tags: [trimmed] });
  if (brandMatch) return brandMatch.tag;
  return slugify(trimmed);
}

function isPlaceholderTitle(title: string) {
  return PLACEHOLDER_PREFIXES.some((prefix) => title.startsWith(prefix));
}

async function ensureCanonicalCategories() {
  const existing = await prisma.category.findMany({
    select: { id: true, nameEn: true, slug: true, status: true, parentId: true },
  });
  const bySlug = new Map(existing.map((category) => [category.slug, category]));
  const categoryIds = new Map<string, string>();

  for (const category of CANONICAL_CATEGORIES) {
    const slug = slugify(category.label);
    const current = bySlug.get(slug);
    if (!current) {
      if (APPLY) {
        const created = await prisma.category.create({
          data: {
            nameEn: category.label,
            slug,
            status: "ACTIVE",
          },
        });
        categoryIds.set(category.label, created.id);
      }
    } else {
      categoryIds.set(category.label, current.id);
      if (
        (current.status !== "ACTIVE" || current.parentId) &&
        APPLY
      ) {
        await prisma.category.update({
          where: { id: current.id },
          data: { status: "ACTIVE", parentId: null, nameEn: category.label },
        });
      }
    }
  }

  if (!APPLY) {
    for (const category of CANONICAL_CATEGORIES) {
      const slug = slugify(category.label);
      const current = bySlug.get(slug);
      if (current) categoryIds.set(category.label, current.id);
    }
  }

  return categoryIds;
}

async function normalizeProducts(categoryIds: Map<string, string>) {
  let updated = 0;
  let skipped = 0;
  let cursor: string | undefined;

  while (true) {
    const products = await prisma.product.findMany({
      where: { isActive: true, qaStatus: "APPROVED" },
      select: {
        id: true,
        slug: true,
        titleEn: true,
        descriptionEn: true,
        tags: true,
        categoryId: true,
        category: { select: { nameEn: true, slug: true } },
      },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    if (!products.length) break;

    await runWithConcurrency(products, concurrency, async (product) => {
      if (isPlaceholderTitle(product.titleEn)) {
        skipped += 1;
        return;
      }

      const sourceText = [
        product.titleEn,
        product.descriptionEn ?? "",
        product.category?.nameEn ?? "",
      ]
        .filter(Boolean)
        .join(" ");

      const normalized = normalizeTitleFromSource(sourceText);
      const detectedCategory = normalizeCategoryLabel(normalized?.category) ??
        normalizeCategoryLabel(product.category?.nameEn) ??
        normalizeCategoryFromSlug(product.category?.slug) ??
        "Accessories";

      const nextCategoryId = categoryIds.get(detectedCategory) ?? product.categoryId;
      const categoryTag = slugify(detectedCategory);

      const brandInfo = getBrandInfo({ tags: product.tags, titleEn: product.titleEn });
      const brandFromCategory = !brandInfo ? extractBrandFromCategorySlug(product.category?.slug) : null;
      const brandTag = brandInfo?.tag ??
        (brandFromCategory ? getBrandInfo({ tags: [brandFromCategory] })?.tag : null);

      const nextTags = new Set<string>();
      for (const tag of product.tags) {
        const normalizedTag = normalizeTag(tag);
        if (!normalizedTag || TAG_DROP.has(normalizedTag)) continue;
        nextTags.add(normalizedTag);
      }
      if (brandTag) nextTags.add(brandTag);
      if (categoryTag && !TAG_DROP.has(categoryTag)) nextTags.add(categoryTag);

      const tagsArray = Array.from(nextTags);

      const categoryChanged = nextCategoryId && nextCategoryId !== product.categoryId;
      const tagsChanged =
        tagsArray.length !== product.tags.length ||
        tagsArray.some((tag) => !product.tags.includes(tag));

      if (!categoryChanged && !tagsChanged) {
        return;
      }

      updated += 1;

      if (APPLY) {
        await prisma.product.update({
          where: { id: product.id },
          data: {
            ...(categoryChanged ? { categoryId: nextCategoryId } : {}),
            ...(tagsChanged ? { tags: tagsArray } : {}),
          },
        });
      }
    });

    cursor = products[products.length - 1].id;
  }

  return { updated, skipped };
}

async function deactivateNonCanonicalCategories() {
  const canonicalSlugs = CANONICAL_CATEGORIES.map((category) => slugify(category.label));
  if (!APPLY) return 0;

  const result = await prisma.category.updateMany({
    where: { slug: { notIn: canonicalSlugs } },
    data: { status: "PENDING" },
  });

  return result.count;
}

async function main() {
  console.log(`Normalize catalog ${APPLY ? "(apply)" : "(dry run)"}`);
  const categoryIds = await ensureCanonicalCategories();
  const { updated, skipped } = await normalizeProducts(categoryIds);
  const deactivated = await deactivateNonCanonicalCategories();

  console.log(`Updated products: ${updated}`);
  console.log(`Skipped placeholder titles: ${skipped}`);
  if (APPLY) {
    console.log(`Deactivated non-canonical categories: ${deactivated}`);
  }
  await prisma.$disconnect();
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  handler: (item: T) => Promise<void>,
) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      await handler(items[index]);
    }
  });
  await Promise.all(workers);
}

main().catch((error) => {
  console.error("Normalization failed", error);
  prisma.$disconnect().finally(() => process.exit(1));
});
