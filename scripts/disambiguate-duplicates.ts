import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { slugify } from "../lib/utils/slug";

dotenv.config();
dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");
const batchSize = Math.max(50, Number(process.env.DEDUPE_BATCH_SIZE ?? 200));
const PLACEHOLDER_PREFIXES = ["Designer Bag", "Luxury Bag #", "Unknown"];

const SIZE_TOKENS = [
  { label: "Mini", re: /\bmini\b/i },
  { label: "Nano", re: /\bnano\b/i },
  { label: "Small", re: /\bsmall\b/i },
  { label: "Medium", re: /\bmedium\b/i },
  { label: "Large", re: /\blarge\b/i },
  { label: "PM", re: /\bpm\b/i },
  { label: "MM", re: /\bmm\b/i },
  { label: "GM", re: /\bgm\b/i },
];

const MATERIAL_TOKENS = [
  { label: "Leather", re: /\bleather\b/i },
  { label: "Canvas", re: /\bcanvas\b/i },
  { label: "Denim", re: /\bdenim\b/i },
  { label: "Suede", re: /\bsuede\b/i },
  { label: "Wool", re: /\bwool\b/i },
  { label: "Silk", re: /\bsilk\b/i },
  { label: "Metal", re: /\bmetal\b/i },
];

const COLOR_TOKENS = [
  { label: "Black", re: /\bblack\b/i },
  { label: "White", re: /\bwhite\b/i },
  { label: "Brown", re: /\bbrown\b/i },
  { label: "Beige", re: /\bbeige\b/i },
  { label: "Camel", re: /\bcamel\b/i },
  { label: "Tan", re: /\btan\b/i },
  { label: "Gray", re: /\bgray\b|\bgrey\b/i },
  { label: "Red", re: /\bred\b/i },
  { label: "Blue", re: /\bblue\b/i },
  { label: "Green", re: /\bgreen\b/i },
  { label: "Pink", re: /\bpink\b/i },
];

const CONDITION_TOKENS = [
  { label: "New", re: /\bnew\b/i },
  { label: "Vintage", re: /\bvintage\b/i },
  { label: "Pre-owned", re: /\bpre[-\s]?owned\b|\bpreowned\b/i },
];

const HARDWARE_TOKENS = [
  { label: "Gold Hardware", re: /\bgold hardware\b/i },
  { label: "Silver Hardware", re: /\bsilver hardware\b/i },
];

const TAG_SKIP = new Set(["editorial", "video", "new", "best-seller"]);

function isPlaceholderTitle(title: string) {
  return PLACEHOLDER_PREFIXES.some((prefix) => title.startsWith(prefix));
}

function normalizeImageUrl(url?: string | null) {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const marker = "/api/image?url=";
  if (trimmed.includes(marker)) {
    try {
      const encoded = trimmed.split(marker)[1];
      return decodeURIComponent(encoded);
    } catch {
      return trimmed;
    }
  }
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return trimmed;
}

function pickCoverUrl(images: Array<{ url: string; isCover: boolean; sortOrder: number }>) {
  if (!images.length) return null;
  const cover = images.find((img) => img.isCover);
  const fallback = images.slice().sort((a, b) => a.sortOrder - b.sortOrder)[0];
  return normalizeImageUrl((cover ?? fallback)?.url ?? null);
}

function collectTokens(text: string, tags: string[]) {
  const tokens: string[] = [];
  const lowerTags = tags.map((tag) => tag.toLowerCase());

  for (const token of SIZE_TOKENS) {
    if (token.re.test(text) || lowerTags.includes(token.label.toLowerCase())) {
      tokens.push(token.label);
      break;
    }
  }

  for (const token of COLOR_TOKENS) {
    if (token.re.test(text) || lowerTags.includes(token.label.toLowerCase())) {
      tokens.push(token.label);
      break;
    }
  }

  for (const token of MATERIAL_TOKENS) {
    if (token.re.test(text) || lowerTags.includes(token.label.toLowerCase())) {
      tokens.push(token.label);
      break;
    }
  }

  for (const token of HARDWARE_TOKENS) {
    if (token.re.test(text)) {
      tokens.push(token.label);
      break;
    }
  }

  for (const token of CONDITION_TOKENS) {
    if (token.re.test(text)) {
      tokens.push(token.label);
      break;
    }
  }

  const sizeMatch = text.match(/\b(\d{2,3})\s?(cm|mm)\b/i);
  if (sizeMatch) {
    tokens.push(`${sizeMatch[1]}${sizeMatch[2].toLowerCase()}`);
  }

  return Array.from(new Set(tokens));
}

function extractSlugVariant(slug: string, title: string) {
  const slugParts = slug.split("-").filter(Boolean);
  const titleParts = new Set(slugify(title).split("-").filter(Boolean));
  const leftover = slugParts.filter((part) => !titleParts.has(part));
  const filtered = leftover.filter((part) => !TAG_SKIP.has(part));
  if (!filtered.length) return null;
  return filtered.slice(-2).join("-").toUpperCase();
}

async function main() {
  console.log(`Disambiguate duplicates ${APPLY ? "(apply)" : "(dry run)"}`);

  const products = new Map<
    string,
    Array<{
      id: string;
      slug: string;
      titleEn: string;
      descriptionEn: string | null;
      tags: string[];
      price: number;
      imageKey: string;
    }>
  >();

  let cursor: string | undefined;

  while (true) {
    const batch = await prisma.product.findMany({
      where: { isActive: true, qaStatus: "APPROVED" },
      select: {
        id: true,
        slug: true,
        titleEn: true,
        descriptionEn: true,
        tags: true,
        price: true,
        images: { select: { url: true, isCover: true, sortOrder: true } },
      },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    if (!batch.length) break;

    for (const product of batch) {
      if (isPlaceholderTitle(product.titleEn)) continue;
      const coverUrl = pickCoverUrl(product.images);
      if (!coverUrl) continue;
      const imageKey = `${product.titleEn.trim().toLowerCase()}::${coverUrl}`;
      const entry = products.get(imageKey) ?? [];
      entry.push({
        id: product.id,
        slug: product.slug,
        titleEn: product.titleEn,
        descriptionEn: product.descriptionEn ?? null,
        tags: product.tags,
        price: Number(product.price),
        imageKey,
      });
      products.set(imageKey, entry);
    }

    cursor = batch[batch.length - 1].id;
  }

  let updated = 0;

  for (const group of products.values()) {
    if (group.length < 2) continue;
    const priceSet = new Set(group.map((item) => item.price.toFixed(2)));
    if (priceSet.size < 2) continue;

    const sorted = group.slice().sort((a, b) => a.price - b.price);
    const usedSuffixes = new Set<string>();

    for (let index = 0; index < sorted.length; index += 1) {
      const item = sorted[index];
      const baseTitle = item.titleEn;
      const text = `${item.titleEn} ${item.descriptionEn ?? ""}`.trim();
      const tokens = collectTokens(text, item.tags);
      let suffix = tokens.slice(0, 2).join(" / ");

      if (!suffix) {
        const slugVariant = extractSlugVariant(item.slug, baseTitle);
        suffix = slugVariant ? `Ref ${slugVariant}` : "";
      }

      if (!suffix || usedSuffixes.has(suffix)) {
        suffix = `Option ${String.fromCharCode(65 + index)}`;
      }

      usedSuffixes.add(suffix);
      const nextTitle = `${baseTitle} - ${suffix}`;

      if (nextTitle === baseTitle || baseTitle.toLowerCase().includes(suffix.toLowerCase())) {
        continue;
      }

      updated += 1;
      if (APPLY) {
        await prisma.product.update({
          where: { id: item.id },
          data: { titleEn: nextTitle },
        });
      }
    }
  }

  console.log(`Updated duplicate titles: ${updated}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Disambiguation failed", error);
  prisma.$disconnect().finally(() => process.exit(1));
});
