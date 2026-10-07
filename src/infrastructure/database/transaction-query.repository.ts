import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import {
  StatementItemDto,
  StatementQueryOptions,
  StatementResponseDto,
} from '../../presentation/dtos/account-statement-query.dto';

@Injectable()
export class TransactionQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getStatementByClient(
    options: StatementQueryOptions,
  ): Promise<StatementResponseDto> {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const fetchLimit = limit + 1;

    const rows = await this.prisma.transaction.findMany({
      take: fetchLimit,
      skip: options.cursorId ? 1 : 0,
      cursor: options.cursorId ? { id: options.cursorId } : undefined,
      where: {
        account: {
          clientId: options.clientId,
        },
      },
      orderBy: [
        { transactionDate: 'desc' },
        { id: 'desc' },
      ],
      select: {
        id: true,
        accountId: true,
        externalId: true,
        amount: true,
        currency: true,
        transactionDate: true,
        description: true,
        status: true,
      },
    });

    const hasMore = rows.length > limit;
    const itemsToReturn = hasMore ? rows.slice(0, limit) : rows;

    const items: StatementItemDto[] = itemsToReturn.map((r) => ({
      id: r.id,
      accountId: r.accountId,
      externalId: r.externalId,
      amount: r.amount.toFixed(2),
      currency: r.currency,
      transactionDate: r.transactionDate.toISOString(),
      description: r.description,
      status: r.status,
    }));

    let nextCursor: { date: string; id: string } | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = {
        date: last.transactionDate,
        id: last.id,
      };
    }

    return {
      data: items,
      pagination: {
        limit,
        hasMore,
        nextCursor,
      },
    };
  }
}
