import { PrismaClient } from "@prisma/client";

const REMOTE_DATABASE_URL = process.env.REMOTE_DATABASE_URL ?? "";

async function retryRemote<T>(
  operation: () => Promise<T>,
  maxRetries = 5,
  delay = 2000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error("Max retries exceeded");
}

export async function syncProductsToRemote(
  productIds: string[]
): Promise<{ success: boolean; synced: number; failed: number }> {
  if (!REMOTE_DATABASE_URL) {
    console.warn("[sync] REMOTE_DATABASE_URL is not configured. Skipping remote sync.");
    return { success: false, synced: 0, failed: 0 };
  }

  const remoteDb = new PrismaClient({
    datasources: {
      db: {
        url: REMOTE_DATABASE_URL,
      },
    },
  });
  const { prisma } = await import("./prisma");

  let synced = 0;
  let failed = 0;

  try {
    // Sync categories first.
    const categories = await prisma.category.findMany();
    for (const cat of categories) {
      try {
        await retryRemote(() =>
          remoteDb.category.upsert({
            where: { id: cat.id },
            create: cat,
            update: cat,
          })
        );
      } catch {
        console.log(`[sync] Failed to sync category ${cat.id}`);
      }
    }

    // Sync requested products.
    for (const productId of productIds) {
      try {
        const product = await prisma.product.findUnique({
          where: { id: productId },
          include: { images: true },
        });

        if (product) {
          const { images, ...productData } = product;

          // Sync product.
          await retryRemote(() =>
            remoteDb.product.upsert({
              where: { id: product.id },
              create: productData,
              update: productData,
            })
          );

          // Sync images.
          for (const img of images) {
            await retryRemote(() =>
              remoteDb.productImage.upsert({
                where: { id: img.id },
                create: img,
                update: img,
              })
            );
          }

          synced++;
        }
      } catch (error) {
        console.log(`[sync] Failed to sync product ${productId}:`, error);
        failed++;
      }
    }

    return { success: true, synced, failed };
  } catch (error) {
    console.error("[sync] Sync to remote failed:", error);
    return { success: false, synced, failed };
  } finally {
    await remoteDb.$disconnect();
  }
}
