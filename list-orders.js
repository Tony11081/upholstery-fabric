const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listOrders() {
  try {
    console.log('Fetching all orders from database...\n');

    const orders = await prisma.order.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      take: 20,
      select: {
        orderNumber: true,
        email: true,
        status: true,
        total: true,
        createdAt: true,
        _count: {
          select: { items: true }
        }
      }
    });

    if (orders.length === 0) {
      console.log('No orders found in database.');
      return;
    }

    console.log(`Found ${orders.length} orders (showing most recent 20):\n`);
    console.log('='.repeat(100));

    orders.forEach((order, index) => {
      console.log(`${index + 1}. Order: ${order.orderNumber}`);
      console.log(`   Email: ${order.email}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Total: $${order.total}`);
      console.log(`   Items: ${order._count.items}`);
      console.log(`   Created: ${order.createdAt}`);
      console.log('-'.repeat(100));
    });

    // Search for orders containing "83577"
    console.log('\nSearching for orders containing "83577"...\n');
    const similarOrders = await prisma.order.findMany({
      where: {
        orderNumber: {
          contains: '83577'
        }
      }
    });

    if (similarOrders.length > 0) {
      console.log(`Found ${similarOrders.length} order(s) containing "83577":`);
      similarOrders.forEach(order => {
        console.log(`  - ${order.orderNumber}`);
      });
    } else {
      console.log('No orders found containing "83577"');
    }

  } catch (error) {
    console.error('Error querying orders:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

listOrders();
