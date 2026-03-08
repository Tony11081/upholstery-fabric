import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();
dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

const placeholders = new Set(
  (process.env.FIX_PLACEHOLDER_TITLES ?? "Designer Bag")
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean),
);
const dryRun = process.env.FIX_DRY_RUN === "true";
const updateBatchSize = Number(process.env.FIX_UPDATE_BATCH_SIZE ?? 50);
const logLimit = Number(process.env.FIX_LOG_LIMIT ?? 20);
const limit = Number(process.env.FIX_LIMIT ?? 0);
const offset = Number(process.env.FIX_OFFSET ?? 0);
const fallbackBrand = process.env.FIX_FALLBACK_BRAND ?? "Luxury";
const codeLength = Number(process.env.FIX_CODE_LENGTH ?? 4);

const BRAND_DISPLAY: Record<string, string> = {
  "balenciaga": "Balenciaga",
  "bottega-veneta": "Bottega Veneta",
  "burberry": "Burberry",
  "bvlgari": "Bvlgari",
  "celine": "Celine",
  "chanel": "Chanel",
  "coach": "Coach",
  "dior": "Dior",
  "fendi": "Fendi",
  "givenchy": "Givenchy",
  "gucci": "Gucci",
  "hermes": "Hermes",
  "loewe": "Loewe",
  "louis-vuitton": "Louis Vuitton",
  "miu-miu": "Miu Miu",
  "prada": "Prada",
  "saint-laurent": "Saint Laurent",
  "valentino": "Valentino",
  "van-cleef-arpels": "Van Cleef & Arpels",
  "versace": "Versace",
};

const BRAND_TAG_ALIASES: Record<string, string> = {
  "lv": "louis-vuitton",
  "ysl": "saint-laurent",
  "saintlaurent": "saint-laurent",
  "bottega": "bottega-veneta",
  "bv": "bottega-veneta",
  "miumiu": "miu-miu",
  "vca": "van-cleef-arpels",
};

const CATEGORY_SINGULAR: Record<string, string> = {
  "bags": "Bag",
  "wallets": "Wallet",
  "card holders": "Card Holder",
  "handbags": "Handbag",
  "shoes": "Shoe",
  "accessories": "Accessory",
  "earrings": "Earring",
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function detectBrandFromText(text?: string | null): string | null {
  if (!text) return null;
  const slugText = `-${slugify(text)}-`;

  for (const slug of Object.keys(BRAND_DISPLAY)) {
    if (slugText.includes(`-${slug}-`)) return BRAND_DISPLAY[slug];
  }

  for (const [alias, canonical] of Object.entries(BRAND_TAG_ALIASES)) {
    if (slugText.includes(`-${alias}-`)) return BRAND_DISPLAY[canonical];
  }

  return null;
}

function detectBrand(input: {
  tags: string[];
  slug: string;
  description?: string | null;
}): string | null {
  if (input.tags.length) {
    const tagsText = input.tags.join(" ");
    const brandFromTags = detectBrandFromText(tagsText);
    if (brandFromTags) return brandFromTags;
  }

  const brandFromSlug = detectBrandFromText(input.slug);
  if (brandFromSlug) return brandFromSlug;

  const brandFromDesc = detectBrandFromText(input.description);
  if (brandFromDesc) return brandFromDesc;

  return null;
}

function singularizeCategory(name?: string | null) {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "Item";
  const key = trimmed.toLowerCase();
  return CATEGORY_SINGULAR[key] ?? trimmed;
}

function buildShortCode(input: string, length: number) {
  if (!input) return "";
  const cleaned = input.replace(/[^0-9a-z]/gi, "");
  return cleaned.slice(-length).toUpperCase();
}

async function fixPlaceholderTitles() {
  const baseWhere = {
    titleEn: { in: Array.from(placeholders) },
    isActive: true,
    qaStatus: "APPROVED",
  } as const;
  const total = await prisma.product.count({ where: baseWhere });
  const maxCount = limit > 0 ? Math.min(limit, total) : total;
  console.log(`Found ${maxCount} placeholder titles.`);

  const products = await prisma.product.findMany({
    where: baseWhere,
    select: {
      id: true,
      slug: true,
      titleEn: true,
      tags: true,
      descriptionEn: true,
      category: { select: { nameEn: true } },
    },
    ...(offset > 0 ? { skip: offset } : {}),
    ...(limit > 0 ? { take: limit } : {}),
  });

  const updates = products
    .map((product) => {
      const brand = detectBrand({
        tags: product.tags,
        slug: product.slug,
        description: product.descriptionEn,
      });
      const categoryLabel = singularizeCategory(product.category?.nameEn);
      const baseTitle = `${brand ?? fallbackBrand} ${categoryLabel}`;
      const shortCode = buildShortCode(product.slug || product.id, codeLength);
      const nextTitle = shortCode ? `${baseTitle} #${shortCode}` : baseTitle;

      if (nextTitle === product.titleEn) return null;

      return {
        id: product.id,
        slug: product.slug,
        before: product.titleEn,
        after: nextTitle,
      };
    })
    .filter((item): item is { id: string; slug: string; before: string; after: string } => Boolean(item));

  if (dryRun) {
    updates.slice(0, logLimit).forEach((item) => {
      console.log(`[dry-run] ${item.slug}: ${item.before} -> ${item.after}`);
    });
    console.log(`Would update ${updates.length} products.`);
    await prisma.$disconnect();
    return;
  }

  let updated = 0;
  for (let i = 0; i < updates.length; i += updateBatchSize) {
    const slice = updates.slice(i, i + updateBatchSize);
    await Promise.all(
      slice.map((item) =>
        prisma.product.update({
          where: { id: item.id },
          data: { titleEn: item.after },
        }),
      ),
    );
    updated += slice.length;
    console.log(`Updated ${updated}/${updates.length}...`);
  }

  console.log(`Updated ${updated} products.`);
  await prisma.$disconnect();
}

fixPlaceholderTitles().catch((error) => {
  console.error(error);
  prisma.$disconnect().catch(() => undefined);
});
