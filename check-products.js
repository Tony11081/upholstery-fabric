const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: { id: true, slug: true, titleEn: true, price: true, createdAt: true }
  });
  console.log('Products in database:');
  console.log(JSON.stringify(products, null, 2));
  console.log(`Total: ${products.length} products`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
