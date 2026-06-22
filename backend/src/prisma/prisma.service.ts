import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not defined');
    }
    const pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
    
    // Auto-seed invite codes if empty
    try {
      const inviteCodeCount = await this.inviteCode.count();
      if (inviteCodeCount === 0) {
        await this.inviteCode.createMany({
          data: [
            { code: 'NOVA-DEMO-1' },
            { code: 'NOVA-DEMO-2' },
            { code: 'NOVA-DEMO-3' },
            { code: 'NOVA-DEMO-4' },
            { code: 'NOVA-DEMO-5' },
          ],
        });
        console.log('Seeded 5 demo invite codes successfully.');
      }
    } catch (err) {
      console.error('Failed to seed invite codes:', err);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
