const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function stats() {
  try {
    const total = await prisma.product.count();
    const optimized = await prisma.product.count({
      where: { optimizationStatus: 'DONE' }
    });
    const pending = await prisma.product.count({
      where: { optimizationStatus: 'PENDING' }
    });
    const inProgress = await prisma.product.count({
      where: { optimizationStatus: 'IN_PROGRESS' }
    });
    const failed = await prisma.product.count({
      where: { optimizationStatus: 'FAILED' }
    });
    
    console.log(JSON.stringify({
      total,
      optimized,
      pending,
      inProgress,
      failed,
      progress: ((optimized / total) * 100).toFixed(1) + '%'
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

stats();
