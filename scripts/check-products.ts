import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkProducts() {
  const products = await prisma.product.findMany({
    take: 20,
    orderBy: { updatedAt: "desc" },
    select: {
      slug: true,
      titleEn: true,
      updatedAt: true,
    },
  });

  console.log("\n最近更新的 20 个产品：\n");
  products.forEach((p, i) => {
    console.log(`${i + 1}. ${p.slug}`);
    console.log(`   标题: ${p.titleEn}`);
    console.log(`   更新时间: ${p.updatedAt.toISOString()}`);
    console.log("");
  });

  await prisma.$disconnect();
}

checkProducts();
