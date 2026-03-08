import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { normalizeTitleFromSource } from "../lib/utils/product-title";
import { translateDescriptionZhToEn } from "../lib/utils/product-description";
import { slugify } from "../lib/utils/slug";

dotenv.config();
dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

const cookie = process.env.SZW_COOKIE ?? "";
if (!cookie) {
  throw new Error("SZW_COOKIE is required");
}

const titlePrefixes = (process.env.SZW_TITLE_PREFIX ?? "Luxury Bag #|Designer Bag")
  .split("|")
  .map((value) => value.trim())
  .filter(Boolean);

const limit = Number(process.env.SZW_LIMIT ?? 0);
const offset = Number(process.env.SZW_OFFSET ?? 0);
const delayMs = Number(process.env.SZW_DELAY_MS ?? 700);
const maxErrors = Number(process.env.SZW_MAX_ERRORS ?? 20);
const fallbackBrand = process.env.SZW_FALLBACK_BRAND ?? "Luxury";
const fallbackCategory = process.env.SZW_FALLBACK_CATEGORY ?? "Bag";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveImageUrl(url: string) {
  if (url.startsWith("/api/image?url=")) {
    try {
      return decodeURIComponent(url.split("url=")[1] ?? "");
    } catch {
      return "";
    }
  }
  return url;
}

function parseSzwegoIds(imageUrl: string) {
  const url = resolveImageUrl(imageUrl);
  const match = url.match(/xcimg\\.szwego\\.com\\/img\\/([^/]+)\\/[^/]+\\/i(\\d+)_/i);
  if (!match) return null;
  return { albumId: match[1], itemId: match[2] };
}

function pickImageUrl(images: Array<{ url: string }>) {
  for (const image of images) {
    const url = resolveImageUrl(image.url);
    if (!url) continue;
    if (url.includes("default_theme_addCart")) continue;
    if (!url.includes("xcimg.szwego.com/img/")) continue;
    return url;
  }
  return "";
}

async function fetchSzwegoProduct(albumId: string, itemId: string) {
  const url = `https://www.szwego.com/commodity/view?targetAlbumId=${albumId}&itemId=${itemId}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Cookie: cookie,
      Referer: "https://www.szwego.com/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Szwego request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    errcode?: number;
    errmsg?: string;
    result?: { commodity?: Record<string, unknown> };
  };

  if (payload?.errcode === 9 || /\\u767b\\u5f55\\u5df2\\u8fc7\\u671f/.test(payload?.errmsg ?? "")) {
    throw new Error("SZW_COOKIE expired");
  }

  const commodity = payload?.result?.commodity ?? {};
  const title =
    (commodity as { title?: string }).title ||
    (commodity as { itemName?: string }).itemName ||
    (commodity as { name?: string }).name ||
    (commodity as { goodsName?: string }).goodsName ||
    "";

  const description =
    (commodity as { desc?: string }).desc ||
    (commodity as { brief?: string }).brief ||
    (commodity as { description?: string }).description ||
    (commodity as { detail?: string }).detail ||
    (commodity as { content?: string }).content ||
    "";

  return {
    title: String(title).trim(),
    description: String(description).trim(),
  };
}

async function normalizeTitles() {
  const where = {
    isActive: true,
    qaStatus: "APPROVED" as const,
    ...(titlePrefixes.length > 0
      ? { OR: titlePrefixes.map((prefix) => ({ titleEn: { startsWith: prefix } })) }
      : {}),
  };

  const products = await prisma.product.findMany({
    where,
    select: {
      id: true,
      slug: true,
      titleEn: true,
      tags: true,
      images: {
        select: { url: true, isCover: true, sortOrder: true },
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
      },
    },
    ...(offset > 0 ? { skip: offset } : {}),
    ...(limit > 0 ? { take: limit } : {}),
  });

  console.log(`Found ${products.length} candidates to normalize.`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const product of products) {
    try {
      const imageUrl = pickImageUrl(product.images);
      if (!imageUrl) {
        skipped += 1;
        continue;
      }

      const ids = parseSzwegoIds(imageUrl);
      if (!ids) {
        skipped += 1;
        continue;
      }

      const { title: sourceTitle, description: sourceDescription } = await fetchSzwegoProduct(
        ids.albumId,
        ids.itemId,
      );
      if (!sourceTitle) {
        skipped += 1;
        continue;
      }

      const normalized = normalizeTitleFromSource(sourceTitle, {
        fallbackBrand,
        fallbackCategory,
      });
      if (!normalized) {
        skipped += 1;
        continue;
      }

      const descriptionEn = sourceDescription
        ? translateDescriptionZhToEn(sourceDescription, {
            title: normalized.title,
            fallbackSummary: "Luxury item",
          })
        : "";

      if (normalized.title === product.titleEn && !descriptionEn) {
        skipped += 1;
        continue;
      }

      const tagSet = new Set(product.tags ?? []);
      if (normalized.brand) {
        tagSet.add(slugify(normalized.brand));
      }
      if (normalized.category) {
        tagSet.add(slugify(normalized.category));
      }

      await prisma.product.update({
        where: { id: product.id },
        data: {
          titleEn: normalized.title,
          ...(descriptionEn ? { descriptionEn } : {}),
          tags: Array.from(tagSet),
        },
      });

      updated += 1;
      if (updated % 20 === 0) {
        console.log(`Updated ${updated}/${products.length}...`);
      }
    } catch (error) {
      errors += 1;
      console.error(`[${product.slug}]`, error);
      if (errors >= maxErrors) {
        throw new Error("Too many errors, aborting.");
      }
    }

    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  console.log(`Done. Updated ${updated}, skipped ${skipped}, errors ${errors}.`);
  await prisma.$disconnect();
}

normalizeTitles().catch((error) => {
  console.error(error);
  prisma.$disconnect().catch(() => undefined);
});
