import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkRecentProducts() {
  console.log("检查最近上传的产品...\n");

  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      titleEn: true,
      tags: true,
      createdAt: true,
      slug: true,
    },
  });

  console.log(`最近 ${products.length} 个产品:\n`);

  products.forEach((product, index) => {
    const date = new Date(product.createdAt).toLocaleString('zh-CN');
    console.log(`${index + 1}. ${product.titleEn}`);
    console.log(`   Slug: ${product.slug}`);
    console.log(`   Tags: [${product.tags.join(", ")}]`);
    console.log(`   创建时间: ${date}`);
    console.log("");
  });

  await prisma.$disconnect();
}

checkRecentProducts();
