import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function test() {
  console.log("Testing database connection...");

  const total = await prisma.product.count();
  console.log(`Total products: ${total}`);

  const uncategorized = await prisma.product.count({
    where: {
      isActive: true,
      qaStatus: "APPROVED",
      OR: [
        { titleEn: "Designer Bag" },
        { tags: { isEmpty: true } },
        { categoryId: null },
      ],
    },
  });
  console.log(`Uncategorized products: ${uncategorized}`);

  await prisma.$disconnect();
}

test();
