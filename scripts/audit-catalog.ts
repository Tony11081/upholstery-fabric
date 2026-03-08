import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();
dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

const PLACEHOLDER_PREFIXES = ["Designer Bag", "Luxury Bag #", "Unknown"];

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

async function audit() {
  const total = await prisma.product.count({ where: { isActive: true, qaStatus: "APPROVED" } });
  const placeholders = await prisma.product.count({
    where: {
      isActive: true,
      qaStatus: "APPROVED",
      OR: PLACEHOLDER_PREFIXES.map((prefix) => ({ titleEn: { startsWith: prefix } })),
    },
  });

  console.log(`Total active products: ${total}`);
  console.log(`Placeholder titles: ${placeholders}`);

  const categories = await prisma.category.findMany({
    select: {
      id: true,
      nameEn: true,
      slug: true,
      status: true,
      _count: { select: { products: true } },
    },
    orderBy: { nameEn: "asc" },
  });

  console.log("\nCategory counts:");
  categories
    .filter((category) => category._count.products > 0)
    .sort((a, b) => b._count.products - a._count.products)
    .forEach((category) => {
      console.log(
        `- ${category.nameEn} (${category.slug}) [${category.status}] - ${category._count.products}`,
      );
    });

  const tagCounts = new Map<string, number>();
  const duplicateGroups = new Map<string, { count: number; prices: Set<string> }>();

  const batchSize = 500;
  let cursor: string | undefined;

  while (true) {
    const products = await prisma.product.findMany({
      where: { isActive: true, qaStatus: "APPROVED" },
      select: {
        id: true,
        titleEn: true,
        price: true,
        tags: true,
        images: { select: { url: true, isCover: true, sortOrder: true } },
      },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    if (!products.length) break;

    for (const product of products) {
      product.tags.forEach((tag) => {
        const key = tag.trim().toLowerCase();
        if (!key) return;
        tagCounts.set(key, (tagCounts.get(key) ?? 0) + 1);
      });

      const coverUrl = pickCoverUrl(product.images);
      if (coverUrl) {
        const key = `${product.titleEn.trim().toLowerCase()}::${coverUrl}`;
        const entry = duplicateGroups.get(key) ?? { count: 0, prices: new Set<string>() };
        entry.count += 1;
        entry.prices.add(Number(product.price).toFixed(2));
        duplicateGroups.set(key, entry);
      }
    }

    cursor = products[products.length - 1].id;
  }

  console.log("\nTop tags:");
  Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .forEach(([tag, count]) => {
      console.log(`- ${tag}: ${count}`);
    });

  const duplicatePriceGroups = Array.from(duplicateGroups.values()).filter(
    (entry) => entry.count > 1 && entry.prices.size > 1,
  );

  console.log(`\nDuplicate image+title groups with price variance: ${duplicatePriceGroups.length}`);

  await prisma.$disconnect();
}

audit().catch((error) => {
  console.error("Audit failed", error);
  prisma.$disconnect().finally(() => process.exit(1));
});
