import { prisma } from './lib/prisma';

async function main() {
  const images = await prisma.productImage.findMany({
    where: { isCover: true },
    select: { url: true, id: true },
    orderBy: { id: 'desc' },
    take: 3
  });
  console.log(JSON.stringify(images, null, 2));
}

main().finally(() => prisma.$disconnect());
