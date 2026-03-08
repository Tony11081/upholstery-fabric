import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkProgress() {
  const total = await prisma.product.count({
    where: { isActive: true, qaStatus: "APPROVED" },
  });

  const defaultTitle = await prisma.product.count({
    where: {
      isActive: true,
      qaStatus: "APPROVED",
      titleEn: "Designer Bag",
    },
  });

  const recognized = total - defaultTitle;

  console.log(`\n总产品数: ${total}`);
  console.log(`已识别: ${recognized} (${((recognized / total) * 100).toFixed(1)}%)`);
  console.log(`未识别: ${defaultTitle} (${((defaultTitle / total) * 100).toFixed(1)}%)`);

  const sample = await prisma.product.findMany({
    where: {
      isActive: true,
      qaStatus: "APPROVED",
      titleEn: { not: "Designer Bag" },
    },
    take: 10,
    select: { titleEn: true, slug: true },
  });

  if (sample.length > 0) {
    console.log(`\n已识别产品示例:`);
    sample.forEach((p, i) => {
      console.log(`${i + 1}. ${p.titleEn}`);
    });
  }

  await prisma.$disconnect();
}

checkProgress();
