import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function deleteProduct() {
  const slug = "designer-bag-1768306714216koyr";

  const product = await prisma.product.findUnique({
    where: { slug },
    select: { id: true, titleEn: true },
  });

  if (!product) {
    console.log(`❌ 产品不存在: ${slug}`);
    await prisma.$disconnect();
    return;
  }

  console.log(`准备删除产品: ${product.titleEn} (${slug})`);

  const orderItems = await prisma.orderItem.deleteMany({
    where: { productId: product.id },
  });

  console.log(`已删除 ${orderItems.count} 条订单记录`);

  await prisma.product.delete({
    where: { slug },
  });

  console.log(`✅ 产品已删除`);
  await prisma.$disconnect();
}

deleteProduct();
