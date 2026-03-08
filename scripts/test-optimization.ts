#!/usr/bin/env tsx
/**
 * Test Product Optimization
 * 
 * This script tests the auto-optimization system by:
 * 1. Selecting 10 products to optimize
 * 2. Creating optimization jobs
 * 3. Monitoring progress
 * 4. Displaying results
 * 
 * Usage:
 *   npx tsx scripts/test-optimization.ts
 */

import { PrismaClient } from '@prisma/client';
import { queueProductOptimization, getOptimizationStatus } from '../lib/product-auto-optimize';

const prisma = new PrismaClient();

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🧪 Testing Product Optimization System');
  console.log('=====================================\n');

  // Step 1: Select 10 products to test
  console.log('📦 Selecting 10 products for testing...');
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      qaStatus: 'APPROVED',
    },
    include: {
      images: {
        take: 1,
        orderBy: { sortOrder: 'asc' },
      },
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
  });

  console.log(`✓ Found ${products.length} products\n`);

  if (products.length === 0) {
    console.log('No products found. Exiting.');
    return;
  }

  // Display selected products
  console.log('Selected products:');
  products.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.titleEn} (${p.id})`);
    console.log(`     Images: ${p.images.length}, Current desc length: ${p.descriptionEn?.length || 0} chars`);
  });
  console.log('');

  // Step 2: Queue optimization jobs
  console.log('🚀 Creating optimization jobs...');
  const jobs = [];
  for (const product of products) {
    try {
      const job = await queueProductOptimization(product.id);
      jobs.push({ productId: product.id, jobId: job.id, title: product.titleEn });
      console.log(`  ✓ Queued: ${product.titleEn.substring(0, 50)}...`);
    } catch (error) {
      console.error(`  ✗ Failed to queue ${product.id}:`, error);
    }
  }
  console.log(`\n✓ Created ${jobs.length} optimization jobs\n`);

  // Step 3: Monitor progress
  console.log('⏳ Monitoring progress (this may take 5-10 minutes)...');
  console.log('Press Ctrl+C to stop monitoring (jobs will continue in background)\n');

  let completed = 0;
  let failed = 0;
  const startTime = Date.now();

  while (completed + failed < jobs.length) {
    await sleep(5000); // Check every 5 seconds

    for (const job of jobs) {
      if (job.status === 'done' || job.status === 'failed') continue;

      const status = await getOptimizationStatus(job.productId);
      
      if (status.status === 'done') {
        completed++;
        job.status = 'done';
        job.result = status.result;
        console.log(`  ✅ [${completed + failed}/${jobs.length}] Completed: ${job.title.substring(0, 40)}...`);
      } else if (status.status === 'failed') {
        failed++;
        job.status = 'failed';
        job.error = status.error;
        console.log(`  ❌ [${completed + failed}/${jobs.length}] Failed: ${job.title.substring(0, 40)}...`);
        console.log(`     Error: ${status.error}`);
      }
    }

    // Show progress
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = jobs.length - completed - failed;
    console.log(`     Progress: ${completed} done, ${failed} failed, ${remaining} pending (${elapsed}s elapsed)`);
  }

  const totalTime = Math.floor((Date.now() - startTime) / 1000);
  console.log(`\n✓ All jobs completed in ${totalTime} seconds\n`);

  // Step 4: Display results
  console.log('📊 Results Summary');
  console.log('==================\n');

  console.log(`Total: ${jobs.length}`);
  console.log(`Completed: ${completed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success rate: ${Math.round((completed / jobs.length) * 100)}%\n`);

  // Show detailed results for completed jobs
  console.log('Detailed Results:');
  console.log('-----------------\n');

  for (const job of jobs) {
    if (job.status === 'done' && job.result) {
      console.log(`✅ ${job.result.productId}`);
      console.log(`   Old title: ${job.title}`);
      console.log(`   New title: ${job.result.titleEn}`);
      console.log(`   Description: ${job.result.descriptionEn.substring(0, 100)}...`);
      console.log(`   Colors found: ${job.result.colors.length}`);
      if (job.result.colors.length > 0) {
        job.result.colors.forEach(c => {
          console.log(`     - ${c.name} (${c.color}): ${c.description}`);
        });
      }
      console.log('');
    }
  }

  // Show failed jobs
  if (failed > 0) {
    console.log('\nFailed Jobs:');
    console.log('------------\n');
    for (const job of jobs) {
      if (job.status === 'failed') {
        console.log(`❌ ${job.productId}: ${job.title}`);
        console.log(`   Error: ${job.error}\n`);
      }
    }
  }

  console.log('\n🎉 Test completed!');
  console.log('\nNext steps:');
  console.log('1. Check the optimized products on the website');
  console.log('2. If satisfied, run batch optimization for all products:');
  console.log('   curl -X POST https://luxuryootd.com/api/admin/optimize-products \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"action": "auto", "limit": 100}\'');
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
