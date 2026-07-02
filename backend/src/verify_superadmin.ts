import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

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

    const email = 'superadmin@fabricore.com';
    const password = 'SuperAdmin123!';

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      console.log(`User with email ${email} not found.`);
      return;
    }

    console.log(`User found:`);
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role}`);
    console.log(`TenantId: ${user.tenantId}`);
    console.log(`Name: ${user.name}`);

    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log(
      `\nPassword verification: ${isPasswordValid ? '✓ Valid' : '✗ Invalid'}`,
    );

    if (!isPasswordValid) {
      console.log('\nResetting password...');
      const hash = await bcrypt.hash(password, 10);
      await prisma.user.update({
        where: { email: email.toLowerCase() },
        data: { password: hash },
      });
      console.log('Password reset successfully.');
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
