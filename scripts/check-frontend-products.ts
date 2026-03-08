import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkFrontendProducts() {
  const products = await prisma.product.findMany({
    where: { isActive: true, qaStatus: "APPROVED" },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: { titleEn: true, slug: true, tags: true, updatedAt: true },
  });

  console.log("\n最近更新的 20 个产品：\n");
  products.forEach((p, i) => {
    console.log(`${i + 1}. ${p.titleEn}`);
    console.log(`   Slug: ${p.slug}`);
    console.log(`   Tags: ${p.tags.join(", ") || "无"}`);
    console.log(`   更新时间: ${p.updatedAt.toISOString()}`);
    console.log("");
  });

  await prisma.$disconnect();
}

checkFrontendProducts();
