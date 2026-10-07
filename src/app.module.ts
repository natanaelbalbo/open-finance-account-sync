import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './infrastructure/database/prisma.service';
import { SyncPostgresRepository } from './infrastructure/database/sync-postgres.repository';
import { TransactionQueryRepository } from './infrastructure/database/transaction-query.repository';
import { InMemoryQueueService } from './infrastructure/queue/in-memory-queue.service';
import { MockPartnerBankClient } from './infrastructure/partner-api/mock-partner-bank.client';
import { StructuredLoggerService } from './infrastructure/logging/structured-logger.service';
import { SyncConsentService } from './application/services/sync-consent.service';
import { SyncQueueConsumer } from './infrastructure/queue/sync-queue.consumer';
import { AccountStatementController } from './presentation/controllers/account-statement.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
  ],
  controllers: [AccountStatementController],
  providers: [
    PrismaService,
    StructuredLoggerService,
    TransactionQueryRepository,
    {
      provide: 'ISyncRepository',
      useClass: SyncPostgresRepository,
    },
    {
      provide: 'IPartnerBankClient',
      useClass: MockPartnerBankClient,
    },
    {
      provide: 'IQueueService',
      useClass: InMemoryQueueService,
    },
    SyncConsentService,
    SyncQueueConsumer,
  ],
  exports: [
    PrismaService,
    SyncConsentService,
    SyncQueueConsumer,
    TransactionQueryRepository,
  ],
})
export class AppModule {}
