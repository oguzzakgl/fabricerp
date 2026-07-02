import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- ALL TENANTS ---');
  const tenants = await prisma.tenant.findMany();
  tenants.forEach((t) => {
    console.log(
      `ID: ${t.id} | Name: ${t.name} | Key: ${t.geminiApiKey} | Length: ${t.geminiApiKey?.length}`,
    );
  });
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
