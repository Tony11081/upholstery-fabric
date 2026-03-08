/**
 * Product Auto-Optimization Hook
 * 
 * This module provides functions to automatically create optimization jobs
 * for products when they are created or updated.
 * 
 * Usage:
 * 1. Call `queueProductOptimization(productId)` after creating a product
 * 2. The Bridge Worker will automatically process the job
 * 3. Product will be updated with optimized content
 */

import { PrismaClient } from '@prisma/client';
import { buildProductMerchandising, repairPersistedProductCatalogData } from '@/lib/utils/product-merchandising';
import { deleteRuntimeKey, readRuntimeJson, saveRuntimeJson } from "@/lib/runtime-kv";

const prisma = new PrismaClient();
const OPTIMIZATION_CURSOR_KEY = "products.optimize.cursor";
const STALE_JOB_MINUTES = 30;

type ProductOptimizationCursor = {
  createdAt: string;
  id: string;
};

type ProductScanRow = {
  id: string;
  titleEn: string;
  tags: string[];
  descriptionEn: string | null;
  createdAt: Date;
  category: {
    slug: string;
  } | null;
};

function buildNeedsOptimizationWhere(cursor: ProductOptimizationCursor | null) {
  if (!cursor) return {};
  const createdAt = new Date(cursor.createdAt);
  if (Number.isNaN(createdAt.getTime())) {
    return {};
  }
  return {
    OR: [
      { createdAt: { gt: createdAt } },
      {
        AND: [
          { createdAt },
          { id: { gt: cursor.id } },
        ],
      },
    ],
  };
}

function needsOptimizationBySignals(product: Pick<ProductScanRow, "titleEn" | "descriptionEn" | "tags" | "category">) {
  const merchandising = buildProductMerchandising({
    title: product.titleEn,
    description: product.descriptionEn,
    tags: product.tags,
    preferExistingTitle: true,
    preferExistingDescription: true,
    currentCategorySlug: product.category?.slug ?? null,
  });
  const { signals } = merchandising;
  return (
    signals.missingCategory ||
    signals.missingBrandTag ||
    signals.missingColors ||
    signals.missingSizes ||
    signals.weakTitle ||
    signals.weakDescription
  );
}

async function fetchOptimizationScanBatch(limit: number) {
  const cursor = await readRuntimeJson<ProductOptimizationCursor>(OPTIMIZATION_CURSOR_KEY);
  const take = Math.max(limit * 12, 240);
  const baseWhere = {
    isActive: true,
    qaStatus: { not: 'REJECTED' as const },
  };
  const select = {
    id: true,
    titleEn: true,
    tags: true,
    descriptionEn: true,
    createdAt: true,
    category: {
      select: {
        slug: true,
      },
    },
  } as const;

  let rows = await prisma.product.findMany({
    where: {
      ...baseWhere,
      ...buildNeedsOptimizationWhere(cursor),
    },
    select,
    take,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  let wrapped = false;
  if (!rows.length && cursor) {
    wrapped = true;
    await deleteRuntimeKey(OPTIMIZATION_CURSOR_KEY);
    rows = await prisma.product.findMany({
      where: baseWhere,
      select,
      take,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  if (rows.length) {
    const last = rows[rows.length - 1];
    await saveRuntimeJson(
      OPTIMIZATION_CURSOR_KEY,
      {
        createdAt: last.createdAt.toISOString(),
        id: last.id,
      } satisfies ProductOptimizationCursor,
      {
        wrapped,
        scannedAt: new Date().toISOString(),
      },
    );
  }

  return { rows: rows as ProductScanRow[], wrapped };
}

export interface ProductOptimizationResult {
  productId: string;
  titleEn: string;
  descriptionEn: string;
  colors: Array<{
    name: string;
    color: string;
    description: string;
  }>;
}

/**
 * Queue a product for optimization via Bridge Worker
 */
export async function queueProductOptimization(productId: string) {
  console.log(`[auto-optimize] Queuing product ${productId} for optimization`);
  await repairPersistedProductCatalogData(prisma, productId);

  const job = await prisma.aiBridgeJob.create({
    data: {
      type: 'PRODUCT_OPTIMIZATION',
      status: 'PENDING',
      request: {
        productId,
        action: 'optimize',
      },
    },
  });

  console.log(`[auto-optimize] Created job ${job.id} for product ${productId}`);
  return job;
}

/**
 * Check if a product needs optimization
 */
export async function needsOptimization(productId: string): Promise<boolean> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      titleEn: true,
      descriptionEn: true,
      tags: true,
      category: {
        select: {
          slug: true,
        },
      },
    },
  });

  if (!product) return false;
  return needsOptimizationBySignals(product);
}

/**
 * Auto-optimize all unoptimized products
 * Call this periodically or on-demand
 */
export async function autoOptimizeUnoptimizedProducts(limit: number = 10) {
  console.log(`[auto-optimize] Scanning for unoptimized products (limit: ${limit})`);

  const staleBefore = new Date(Date.now() - 1000 * 60 * STALE_JOB_MINUTES);

  // 1. Reset stuck/failed jobs first (Automatic Recovery)
  try {
    const [resetStale, resetFailed] = await Promise.all([
      prisma.aiBridgeJob.updateMany({
        where: {
          type: 'PRODUCT_OPTIMIZATION',
          status: 'IN_PROGRESS',
          lockedAt: { lt: staleBefore },
        },
        data: {
          status: 'PENDING',
          lockId: null,
          lockedAt: null,
          error: 'Recovered stale in-progress job',
        }
      }),
      prisma.aiBridgeJob.updateMany({
        where: {
          type: 'PRODUCT_OPTIMIZATION',
          status: 'FAILED',
          // Retry jobs that failed in the last 24 hours
          updatedAt: { gt: new Date(Date.now() - 1000 * 60 * 60 * 24) }
        },
        data: {
          status: 'PENDING',
          attempts: 0,
          error: null
        }
      }),
    ]);
    console.log(`[auto-optimize] Reset stale jobs=${resetStale.count}, failed jobs=${resetFailed.count}`);
  } catch (e) {
    console.error('[auto-optimize] Error resetting jobs:', e);
  }

  const { rows: products, wrapped } = await fetchOptimizationScanBatch(limit);
  const candidates = products.filter((product) => needsOptimizationBySignals(product)).slice(0, limit);

  console.log(
    `[auto-optimize] Scanned ${products.length} products, found ${candidates.length} candidates after filtering${wrapped ? " (wrapped to start)" : ""}`,
  );

  const jobs = [];
  let repairedCount = 0;
  for (const product of candidates) {
    const repairResult = await repairPersistedProductCatalogData(prisma, product.id);
    if (repairResult?.changed) {
      repairedCount += 1;
    }
    if (repairResult && !repairResult.signals.needsAiPolish) {
      continue;
    }

    // Check if already has a pending/in-progress job
    const existingJob = await prisma.aiBridgeJob.findFirst({
      where: {
        type: 'PRODUCT_OPTIMIZATION',
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        request: {
          path: ['productId'],
          equals: product.id,
        },
      },
    });

    if (existingJob) {
      continue;
    }

    const job = await queueProductOptimization(product.id);
    jobs.push(job);
  }

  console.log(`[auto-optimize] Queued ${jobs.length} new optimization jobs`);
  return { jobs, repaired: repairedCount, scanned: products.length, wrapped };
}

/**
 * Get optimization status for a product
 */
export async function getOptimizationStatus(productId: string) {
  const job = await prisma.aiBridgeJob.findFirst({
    where: {
      type: 'PRODUCT_OPTIMIZATION',
      request: {
        path: ['productId'],
        equals: productId,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!job) {
    return { status: 'not_queued' as const };
  }

  return {
    status: job.status.toLowerCase() as 'pending' | 'in_progress' | 'done' | 'failed',
    jobId: job.id,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    error: job.error,
    result: job.response as ProductOptimizationResult | null,
  };
}
