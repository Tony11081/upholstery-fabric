import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkDataIntegrity() {
  console.log("🔍 检查数据完整性...\n");

  // 1. 检查产品总数
  const totalProducts = await prisma.product.count();
  console.log(`📦 总产品数: ${totalProducts}`);

  // 2. 检查品牌
  const totalBrands = await prisma.brand.count();
  const activeBrands = await prisma.brand.count({ where: { isActive: true } });
  console.log(`🏷️  总品牌数: ${totalBrands} (活跃: ${activeBrands})`);

  // 3. 检查有品牌的产品
  const productsWithBrand = await prisma.product.count({
    where: { brandId: { not: null } },
  });
  console.log(`🔗 已关联品牌的产品: ${productsWithBrand}/${totalProducts} (${Math.round(productsWithBrand / totalProducts * 100)}%)`);

  // 4. 检查产品变体
  const totalVariants = await prisma.productVariant.count();
  const productsWithVariants = await prisma.product.count({
    where: { variants: { some: {} } },
  });
  console.log(`🎨 总变体数: ${totalVariants}`);
  console.log(`🎨 有变体的产品: ${productsWithVariants}/${totalProducts} (${Math.round(productsWithVariants / totalProducts * 100)}%)`);

  // 5. 检查缺少标题的产品
  const missingTitle = await prisma.product.count({
    where: {
      OR: [
        { titleEn: null },
        { titleEn: "" },
      ],
    },
  });
  console.log(`⚠️  缺少标题的产品: ${missingTitle}`);

  // 6. 检查缺少描述的产品
  const missingDescription = await prisma.product.count({
    where: {
      OR: [
        { descriptionEn: null },
        { descriptionEn: "" },
      ],
    },
  });
  console.log(`⚠️  缺少描述的产品: ${missingDescription}`);

  // 7. 检查缺少分类的产品
  const missingCategory = await prisma.product.count({
    where: { categoryId: null },
  });
  console.log(`⚠️  缺少分类的产品: ${missingCategory}`);

  // 8. 检查缺少图片的产品
  const missingImages = await prisma.product.count({
    where: { images: { none: {} } },
  });
  console.log(`⚠️  缺少图片的产品: ${missingImages}`);

  // 9. 检查库存为0的产品
  const outOfStock = await prisma.product.count({
    where: { inventory: 0 },
  });
  console.log(`📉 库存为0的产品: ${outOfStock}`);

  // 10. 变体统计
  const variantsWithColor = await prisma.productVariant.count({
    where: { color: { not: null } },
  });
  const variantsWithSize = await prisma.productVariant.count({
    where: { size: { not: null } },
  });
  console.log(`🎨 有颜色的变体: ${variantsWithColor}/${totalVariants}`);
  console.log(`📏 有尺寸的变体: ${variantsWithSize}/${totalVariants}`);

  // 11. 品牌产品分布
  console.log("\n📊 品牌产品分布（前10）:");
  const brandStats = await prisma.brand.findMany({
    where: { isActive: true },
    include: {
      _count: {
        select: { products: true },
      },
    },
    orderBy: {
      products: {
        _count: "desc",
      },
    },
    take: 10,
  });

  brandStats.forEach((brand, index) => {
    console.log(`   ${index + 1}. ${brand.name}: ${brand._count.products} 产品`);
  });

  // 12. 数据质量评分
  console.log("\n📈 数据质量评分:");
  const qualityScore = Math.round(
    ((totalProducts - missingTitle) / totalProducts * 20) +
    ((totalProducts - missingDescription) / totalProducts * 20) +
    ((totalProducts - missingCategory) / totalProducts * 20) +
    ((totalProducts - missingImages) / totalProducts * 20) +
    (productsWithBrand / totalProducts * 20)
  );
  console.log(`   总分: ${qualityScore}/100`);

  if (qualityScore >= 80) {
    console.log("   ✅ 数据质量良好");
  } else if (qualityScore >= 60) {
    console.log("   ⚠️  数据质量一般，建议优化");
  } else {
    console.log("   ❌ 数据质量较差，需要改进");
  }

  // 13. 建议
  console.log("\n💡 改进建议:");
  if (missingTitle > 0) {
    console.log(`   - 填写 ${missingTitle} 个产品的标题`);
  }
  if (missingDescription > 0) {
    console.log(`   - 填写 ${missingDescription} 个产品的描述（运行 generate-product-descriptions.ts）`);
  }
  if (missingCategory > 0) {
    console.log(`   - 为 ${missingCategory} 个产品分配分类`);
  }
  if (missingImages > 0) {
    console.log(`   - 为 ${missingImages} 个产品添加图片`);
  }
  if (productsWithBrand < totalProducts) {
    console.log(`   - 为 ${totalProducts - productsWithBrand} 个产品关联品牌（运行 migrate-brands.ts）`);
  }
  if (productsWithVariants < totalProducts) {
    console.log(`   - 为 ${totalProducts - productsWithVariants} 个产品创建变体（运行 create-variants.ts）`);
  }
}

checkDataIntegrity()
  .catch((error) => {
    console.error("检查失败:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
