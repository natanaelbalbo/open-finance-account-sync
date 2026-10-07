//queries e respostas de extrato
export interface StatementQueryOptions {
  clientId: string;
  limit?: number;
  cursorDate?: string;
  cursorId?: string;
}

export interface StatementItemDto {
  id: string;
  accountId: string;
  externalId: string;
  amount: string;
  currency: string;
  transactionDate: string;
  description: string;
  status: string;
}

export interface StatementResponseDto {
  data: StatementItemDto[];
  pagination: {
    limit: number;
    hasMore: boolean;
    nextCursor: {
      date: string;
      id: string;
    } | null;
  };
}
