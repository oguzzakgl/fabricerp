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
  console.log('--- USERS ---');
  const users = await prisma.user.findMany({
    include: { tenant: true }
  });
  console.log(JSON.stringify(users, null, 2));

  console.log('--- INVITE CODES ---');
  const codes = await prisma.inviteCode.findMany();
  console.log(JSON.stringify(codes, null, 2));

  console.log('--- TENANTS ---');
  const tenants = await prisma.tenant.findMany();
  console.log(JSON.stringify(tenants, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
