const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

async function testConnection() {
  try {
    console.log('Testing database connection...');
    const result = await prisma.category.findFirst({ where: { slug: 'bags' } });
    console.log('✓ Database connection successful!');
    console.log('Category found:', result);
  } catch (error) {
    console.error('✗ Database connection failed:');
    console.error(error.message);
    console.error('Error code:', error.code);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
