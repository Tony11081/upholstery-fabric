const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function queryOrder() {
  try {
    const orderNumber = 'UOOTD-RQ-2026-01-83577';

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
      console.log('Order not found in database.');
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
            console.log(`    ${imgIndex + 1}. ${img.url} ${img.isCover ? '(Cover)' : ''}`);
          });
        } else {
          console.log(`  No images found`);
        }

        // Product page link
        console.log(`  Product Page: /products/${item.product.slug}`);
      } else {
        console.log(`  (Product no longer exists in database)`);
      }
      console.log('-'.repeat(80));
    });

  } catch (error) {
    console.error('Error querying order:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

queryOrder();
