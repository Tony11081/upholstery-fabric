const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ log: ['query', 'error', 'warn'] });

async function withRetry(operation, maxRetries = 3, delayMs = 1000) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        console.log(`Retry ${i + 1}/${maxRetries - 1}...`);
        await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
      }
    }
  }
  throw lastError;
}

async function testConnection() {
  try {
    console.log('Testing database connection with retry...');
    const result = await withRetry(() => prisma.category.findFirst({ where: { slug: 'bags' } }));
    console.log('✓ Database connection successful!');
    console.log('Category found:', result);
  } catch (error) {
    console.error('✗ Database connection failed:');
    console.error(error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
