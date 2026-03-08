const { PrismaClient } = require('@prisma/client');

// 本地数据库
const localDb = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://luxury-shop:luxury123@localhost:5432/luxury-shop?schema=public'
    }
  }
});

// 远程数据库
const remoteDb = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://luxury-shop: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@23.94.38.181:5433/luxury-shop?schema=public&connect_timeout=60'
    }
  }
});

async function retryOperation(operation, name, maxRetries = 10, delay = 3000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      console.log(`   [${name}] Retry ${i + 1}/${maxRetries}...`);
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw error;
      }
    }
  }
}

async function syncToRemote() {
  console.log('=== Syncing LOCAL → REMOTE ===\n');

  try {
    // 同步分类
    console.log('1. Syncing categories...');
    const categories = await localDb.category.findMany();
    console.log(`   Found ${categories.length} categories locally`);

    for (const cat of categories) {
      await retryOperation(
        () => remoteDb.category.upsert({
          where: { id: cat.id },
          create: cat,
          update: cat
        }),
        'category'
      );
    }
    console.log('   ✓ Categories synced!\n');

    // 同步产品
    console.log('2. Syncing products...');
    const products = await localDb.product.findMany();
    console.log(`   Found ${products.length} products locally`);

    for (const prod of products) {
      await retryOperation(
        () => remoteDb.product.upsert({
          where: { id: prod.id },
          create: prod,
          update: prod
        }),
        'product'
      );
      process.stdout.write('.');
    }
    console.log('\n   ✓ Products synced!\n');

    // 同步产品图片
    console.log('3. Syncing product images...');
    const images = await localDb.productImage.findMany();
    console.log(`   Found ${images.length} images locally`);

    for (const img of images) {
      await retryOperation(
        () => remoteDb.productImage.upsert({
          where: { id: img.id },
          create: img,
          update: img
        }),
        'image'
      );
      process.stdout.write('.');
    }
    console.log('\n   ✓ Images synced!\n');

    console.log('=== SYNC COMPLETED SUCCESSFULLY ===');

  } catch (error) {
    console.error('\nSync failed:', error.message);
    console.log('\nTip: Remote database may be unstable. Try again later.');
  } finally {
    await localDb.$disconnect();
    await remoteDb.$disconnect();
  }
}

syncToRemote();
