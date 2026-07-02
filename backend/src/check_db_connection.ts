import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  console.log(
    'Current DATABASE_URL:',
    connectionString ? connectionString.substring(0, 50) + '...' : 'NOT SET',
  );

  if (!connectionString) {
    console.error('DATABASE_URL is not set!');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$connect();
    console.log('✓ Database connection successful');

    const userCount = await prisma.user.count();
    const tenantCount = await prisma.tenant.count();
    const accountCount = await prisma.account.count();

    console.log('Database statistics:');
    console.log(`- Users: ${userCount}`);
    console.log(`- Tenants: ${tenantCount}`);
    console.log(`- Accounts: ${accountCount}`);

    // Check if this is Neon DB by looking at the connection string
    if (
      connectionString.includes('neon.tech') ||
      connectionString.includes('neon')
    ) {
      console.log('✓ Connected to Neon DB');
    } else if (
      connectionString.includes('localhost') ||
      connectionString.includes('127.0.0.1')
    ) {
      console.log('⚠ Connected to Local PostgreSQL (not Neon)');
    } else {
      console.log('? Unknown database type');
    }
  } catch (err) {
    console.error('Error connecting to database:', err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
