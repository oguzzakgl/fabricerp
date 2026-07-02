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

    const superadmins = await prisma.user.findMany({
      where: { role: 'SUPERADMIN' },
    });

    console.log(`--- SUPERADMIN ACCOUNTS (${superadmins.length}) ---`);
    superadmins.forEach((u) => {
      console.log(
        `Email: ${u.email} | Name: ${u.name} | TenantId: ${u.tenantId}`,
      );
    });

    if (superadmins.length > 1) {
      console.log('\n⚠️  Multiple superadmin accounts found!');
      console.log('Keeping only superadmin@fabricore.com, deleting others...');

      for (const admin of superadmins) {
        if (admin.email !== 'superadmin@fabricore.com') {
          await prisma.user.delete({
            where: { email: admin.email },
          });
          console.log(`Deleted: ${admin.email}`);
        }
      }

      console.log(
        '\n✓ Cleanup complete. Only superadmin@fabricore.com remains.',
      );
    } else if (superadmins.length === 1) {
      console.log('\n✓ Only one superadmin account exists.');
    } else {
      console.log('\n⚠️  No superadmin accounts found!');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
