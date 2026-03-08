import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function test() {
  console.log("Testing simple query...");

  const start = Date.now();
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      qaStatus: "APPROVED",
      titleEn: "Designer Bag",
    },
  });
  const elapsed = Date.now() - start;

  console.log(`Found ${products.length} products in ${elapsed}ms`);

  await prisma.$disconnect();
}

test();
