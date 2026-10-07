import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import {
  BatchInsertResult,
  ISyncRepository,
} from '../../domain/ports/sync-repository.port';
import { ConsentEntity } from '../../domain/entities/consent.entity';
import { AccountEntity } from '../../domain/entities/account.entity';
import { TransactionEntity } from '../../domain/entities/transaction.entity';
import { ConsentStatus } from '../../domain/types/financial-types';

@Injectable()
export class SyncPostgresRepository implements ISyncRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findConsentById(consentId: string): Promise<ConsentEntity | null> {
    const row = await this.prisma.consent.findUnique({
      where: { id: consentId },
    });

    if (!row) return null;

    return new ConsentEntity({
      id: row.id,
      clientId: row.clientId,
      institutionId: row.institutionId,
      externalId: row.externalId,
      status: row.status as ConsentStatus,
      expiresAt: row.expiresAt,
      lastSuccessfulSyncAt: row.lastSuccessfulSyncAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async findOrCreateAccount(account: AccountEntity): Promise<AccountEntity> {
    const row = await this.prisma.account.upsert({
      where: {
        uk_accounts_institution_external: {
          institutionId: account.institutionId,
          externalId: account.externalId,
        },
      },
      update: {
        number: account.number,
      },
      create: {
        clientId: account.clientId,
        institutionId: account.institutionId,
        externalId: account.externalId,
        number: account.number,
        type: account.type,
      },
    });

    return new AccountEntity({
      id: row.id,
      clientId: row.clientId,
      institutionId: row.institutionId,
      externalId: row.externalId,
      number: row.number || undefined,
      type: row.type,
      createdAt: row.createdAt,
    });
  }

  async associateConsentWithAccount(
    consentId: string,
    accountId: string,
  ): Promise<void> {
    await this.prisma.consentAccount.upsert({
      where: {
        consentId_accountId: {
          consentId,
          accountId,
        },
      },
      update: {},
      create: {
        consentId,
        accountId,
      },
    });
  }

  async saveTransactionsBatch(
    transactions: TransactionEntity[],
  ): Promise<BatchInsertResult> {
    if (transactions.length === 0) {
      return { insertedCount: 0, duplicateCount: 0 };
    }

    const data = transactions.map((tx) => ({
      accountId: tx.accountId,
      externalId: tx.externalId,
      amount: new Prisma.Decimal(tx.amount),
      currency: tx.currency,
      transactionDate: tx.transactionDate,
      description: tx.description,
      status: tx.status,
    }));

    const result = await this.prisma.transaction.createMany({
      data,
      skipDuplicates: true,
    });

    const insertedCount = result.count;
    const duplicateCount = transactions.length - insertedCount;

    return { insertedCount, duplicateCount };
  }

  async updateLastSuccessfulSync(
    consentId: string,
    syncDate: Date,
  ): Promise<void> {
    await this.prisma.consent.update({
      where: { id: consentId },
      data: {
        lastSuccessfulSyncAt: syncDate,
      },
    });
  }
}
