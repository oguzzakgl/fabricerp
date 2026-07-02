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

    const email = 'oguzzakg@gmail.com';

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      console.log(`User with email ${email} not found.`);
      return;
    }

    // Delete user (cascade will handle related records)
    const deleted = await prisma.user.delete({
      where: { email: email.toLowerCase() },
    });

    console.log(`User deleted successfully:`);
    console.log(`Email: ${deleted.email}`);
    console.log(`Name: ${deleted.name}`);
    console.log(`Role: ${deleted.role}`);
  } catch (err) {
    console.error('Error deleting user:', err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
