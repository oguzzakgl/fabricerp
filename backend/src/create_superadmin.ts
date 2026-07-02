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

    // Superadmin credentials - you can modify these
    const email = 'superadmin@fabricerp.com';
    const password = 'SuperAdmin123!'; // Change this to a secure password
    const name = 'Super Admin';

    // Check if superadmin already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      console.log(`User with email ${email} already exists.`);
      console.log('Updating to superadmin role...');

      const hash = await bcrypt.hash(password, 10);
      const updated = await prisma.user.update({
        where: { email: email.toLowerCase() },
        data: {
          password: hash,
          role: 'SUPERADMIN',
          tenantId: null, // Superadmin should not be tied to a specific tenant
        },
      });

      console.log('Superadmin updated successfully:');
      console.log(`Email: ${updated.email}`);
      console.log(`Role: ${updated.role}`);
      console.log(`Name: ${updated.name}`);
    } else {
      // Create new superadmin
      const hash = await bcrypt.hash(password, 10);
      const superadmin = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          password: hash,
          name: name,
          role: 'SUPERADMIN',
          tenantId: null, // Superadmin should not be tied to a specific tenant
          plan: 'ENTERPRISE',
        },
      });

      console.log('Superadmin created successfully:');
      console.log(`Email: ${superadmin.email}`);
      console.log(`Role: ${superadmin.role}`);
      console.log(`Name: ${superadmin.name}`);
      console.log('Password:', password);
      console.log('\n⚠️  IMPORTANT: Change the password after first login!');
    }
  } catch (err) {
    console.error('Error creating superadmin:', err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
