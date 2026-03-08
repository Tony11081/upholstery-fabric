import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function test() {
  console.log("Testing findMany with images...");

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      qaStatus: "APPROVED",
      OR: [
        { titleEn: "Designer Bag" },
        { tags: { isEmpty: true } },
        { categoryId: null },
      ],
    },
    include: { images: { take: 1 } },
    take: 10,
  });

  console.log(`Found ${products.length} products`);
  console.log(`First product: ${products[0]?.titleEn}`);
  console.log(`First image: ${products[0]?.images[0]?.url}`);

  await prisma.$disconnect();
}

test();
