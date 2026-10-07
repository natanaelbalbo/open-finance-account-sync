import { Injectable, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Optional() pool?: Pool) {
    if (pool) {
      const adapter = new PrismaPg(pool);
      super({ adapter });
    } else {
      super();
    }
  }

  async onModuleInit() {
    try {
      await this.$connect();
    } catch {
      // Conexão inicial sob demanda
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
