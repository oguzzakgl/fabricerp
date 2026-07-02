import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not defined');
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. Davet Kodlarını Oluştur
  const codes = ['FABRIC-INV1', 'FABRIC-INV2', 'FABRIC-INV3'];
  for (const code of codes) {
    try {
      const result = await prisma.inviteCode.upsert({
        where: { code },
        update: {},
        create: {
          code,
          isUsed: false,
        },
      });
      console.log(`Davet kodu oluşturuldu veya zaten var: ${result.code}`);
    } catch (error) {
      console.error(`Kod oluşturulurken hata (${code}):`, error);
    }
  }

  // 2. Hazır Giriş Yapılabilecek Admin Kullanıcısı Oluştur
  const adminEmail = 'admin@fabricore.com';
  const adminPassword = 'admin123';
  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!existingUser) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      const newUser = await prisma.user.create({
        data: {
          email: adminEmail,
          password: passwordHash,
          role: 'ADMIN',
          name: 'Sistem Yöneticisi',
        },
      });
      console.log(`Hazır Admin Kullanıcısı Başarıyla Oluşturuldu!`);
      console.log(`E-posta: ${newUser.email}`);
      console.log(`Şifre: ${adminPassword}`);
    } else {
      console.log(`Hazır Admin Kullanıcısı zaten mevcut: ${adminEmail}`);
    }
  } catch (error) {
    console.error('Admin kullanıcısı oluşturulurken hata:', error);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
