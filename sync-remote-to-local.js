const { PrismaClient } = require('@prisma/client');

// 远程数据库
const remoteDb = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://luxury-shop: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@23.94.38.181:5433/luxury-shop?schema=public&connect_timeout=60'
    }
  }
});

// 本地数据库
const localDb = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://luxury-shop:luxury123@localhost:5432/luxury-shop?schema=public'
    }
  }
});

async function syncData() {
  console.log('Starting database sync...');

  try {
    // 同步分类
    console.log('\n1. Syncing categories...');
    const categories = await retryOperation(() => remoteDb.category.findMany());
    console.log(`   Found ${categories.length} categories`);

    for (const cat of categories) {
      await localDb.category.upsert({
        where: { id: cat.id },
        create: cat,
        update: cat
      });
    }
    console.log('   Categories synced!');

    // 同步产品
    console.log('\n2. Syncing products...');
    const products = await retryOperation(() => remoteDb.product.findMany());
    console.log(`   Found ${products.length} products`);

    for (const prod of products) {
      await localDb.product.upsert({
        where: { id: prod.id },
        create: prod,
        update: prod
      });
    }
    console.log('   Products synced!');

    // 同步产品图片
    console.log('\n3. Syncing product images...');
    const images = await retryOperation(() => remoteDb.productImage.findMany());
    console.log(`   Found ${images.length} images`);

    for (const img of images) {
      await localDb.productImage.upsert({
        where: { id: img.id },
        create: img,
        update: img
      });
    }
    console.log('   Images synced!');

    console.log('\n✓ Sync completed successfully!');

  } catch (error) {
    console.error('Sync failed:', error.message);
  } finally {
    await remoteDb.$disconnect();
    await localDb.$disconnect();
  }
}

async function retryOperation(operation, maxRetries = 5, delay = 3000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i < maxRetries - 1) {
        console.log(`   Retry ${i + 1}/${maxRetries - 1}...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw error;
      }
    }
  }
}

syncData();
