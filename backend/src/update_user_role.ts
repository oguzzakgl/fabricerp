import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set!');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$connect();

    const email = 'emrekecabas1@gmail.com';
    const newRole = 'USER';

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      console.log(`User with email ${email} not found.`);
      return;
    }

    const updated = await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { role: newRole },
    });

    console.log(`User role updated successfully:`);
    console.log(`Email: ${updated.email}`);
    console.log(`Old role: ${user.role}`);
    console.log(`New role: ${updated.role}`);
  } catch (err) {
    console.error('Error updating user role:', err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
