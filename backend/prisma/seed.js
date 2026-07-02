const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding veritabanı...');

  // 1. Super Admin kullanıcısı (tenantId = null)
  const superAdminPassword = await bcrypt.hash('Admin1234!', 10);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@fabricore.com' },
    update: {},
    create: {
      email: 'admin@fabricore.com',
      name: 'Super Admin',
      password: superAdminPassword,
      role: 'SUPER_ADMIN',
      tenantId: null,
    },
  });
  console.log('✅ Super Admin:', superAdmin.email);

  // 2. Test Tenant oluştur
  const testTenant = await prisma.tenant.upsert({
    where: { email: 'test@fabricore.com' },
    update: {},
    create: {
      name: 'Test Fabrika A.Ş.',
      email: 'test@fabricore.com',
      phone: '+90 555 000 0000',
      plan: 'pro',
    },
  });
  console.log('✅ Test Tenant:', testTenant.name);

  // 3. Tenant Admin kullanıcısı
  const tenantAdminPassword = await bcrypt.hash('Test1234!', 10);
  const tenantAdmin = await prisma.user.upsert({
    where: { email: 'user@fabricore.com' },
    update: {},
    create: {
      email: 'user@fabricore.com',
      name: 'Test Kullanıcı',
      password: tenantAdminPassword,
      role: 'ADMIN',
      tenantId: testTenant.id,
    },
  });
  console.log('✅ Tenant Admin:', tenantAdmin.email);

  console.log('\n🎉 Seed tamamlandı!');
  console.log('─────────────────────────────────────');
  console.log('👑 Super Admin  → admin@fabricore.com / Admin1234!');
  console.log('👤 Tenant Admin → user@fabricore.com  / Test1234!');
  console.log('─────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
