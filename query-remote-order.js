const { PrismaClient } = require('@prisma/client');

// Use remote database URL
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://luxury-shop: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@23.94.38.181:5433/luxury-shop?schema=public&connect_timeout=30&pool_timeout=30&connection_limit=3&sslmode=disable'
    }
  }
});

async function queryRemoteOrder() {
  try {
    const orderNumber = 'UOOTD-RQ-2026-01-83577';

    console.log(`Connecting to remote database...`);
    console.log(`Searching for order: ${orderNumber}\n`);

    const order = await prisma.order.findFirst({
      where: {
        orderNumber: orderNumber,
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  orderBy: { sortOrder: 'asc' }
                }
              }
            }
          }
        }
      }
    });

    if (!order) {
      console.log('Order not found in remote database.');

      // Try to list some orders to verify connection
      console.log('\nChecking if remote database has any orders...');
      const orderCount = await prisma.order.count();
      console.log(`Total orders in remote database: ${orderCount}`);

      if (orderCount > 0) {
        console.log('\nSearching for similar order numbers...');
        const recentOrders = await prisma.order.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: { orderNumber: true, createdAt: true }
        });
        console.log('Recent orders:');
        recentOrders.forEach(o => console.log(`  - ${o.orderNumber} (${o.createdAt})`));
      }
      return;
    }

    console.log('='.repeat(80));
    console.log(`Order Number: ${order.orderNumber}`);
    console.log(`Email: ${order.email}`);
    console.log(`Status: ${order.status}`);
    console.log(`Total: $${order.total}`);
    console.log(`Created: ${order.createdAt}`);
    console.log('='.repeat(80));
    console.log('\nPRODUCTS IN ORDER:\n');

    order.items.forEach((item, index) => {
      console.log(`\n[Product ${index + 1}]`);
      console.log(`  Title: ${item.titleSnapshot}`);
      console.log(`  Quantity: ${item.qty}`);
      console.log(`  Price: $${item.price}`);

      if (item.product) {
        console.log(`  Product ID: ${item.product.id}`);
        console.log(`  Product Slug: ${item.product.slug}`);
        console.log(`  Current Title: ${item.product.titleEn}`);

        if (item.product.images && item.product.images.length > 0) {
          console.log(`  Product Images:`);
          item.product.images.forEach((img, imgIndex) => {
            console.log(`    ${imgIndex + 1}. ${img.url} ${img.isCover ? '(Cover Image)' : ''}`);
          });
        } else {
          console.log(`  No images found`);
        }

        console.log(`  Product Page: /products/${item.product.slug}`);
      } else {
        console.log(`  (Product no longer exists in database)`);
      }
      console.log('-'.repeat(80));
    });

  } catch (error) {
    console.error('Error querying remote order:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

queryRemoteOrder();
