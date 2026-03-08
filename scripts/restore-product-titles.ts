import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function restoreProductTitles() {
  console.log("开始恢复被错误更新的产品标题...\n");

  // 查找所有包含错误消息的产品标题
  const errorPatterns = [
    "I don't see",
    "I can't identify",
    "I don't have the ability",
    "I cannot identify",
    "I can see multiple",
    "Could you clarify",
  ];

  const products = await prisma.product.findMany({
    where: {
      OR: errorPatterns.map((pattern) => ({
        titleEn: { contains: pattern },
      })),
    },
    select: {
      id: true,
      slug: true,
      titleEn: true,
    },
  });

  console.log(`找到 ${products.length} 个需要恢复的产品\n`);

  let count = 0;
  for (const product of products) {
    // 恢复为默认标题
    await prisma.product.update({
      where: { id: product.id },
      data: { titleEn: "Designer Bag" },
    });
    count++;
    if (count % 50 === 0) {
      console.log(`已恢复 ${count}/${products.length} 个产品...`);
    }
  }

  console.log(`\n✅ 成功恢复 ${count} 个产品标题`);
  await prisma.$disconnect();
}

restoreProductTitles();
