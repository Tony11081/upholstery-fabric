import { Client } from 'pg';

const connectionString = 'postgresql://luxury-shop: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@whatsapp-luxuryshop-mi3joy:5432/luxury-shop?schema=public';

async function scanDatabase() {
  const client = new Client({ connectionString });
  
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');
    
    // Get table list
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('📋 Tables in database:');
    tables.rows.forEach(row => console.log('  -', row.table_name));
    
    await client.end();
  } catch (err: any) {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  }
}

scanDatabase();
