import { IPartnerBankClient } from '../../domain/ports/partner-bank-client.port';
import { PartnerPageResponse } from '../../domain/types/financial-types';

export class PartnerApiException extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'PartnerApiException';
    this.statusCode = statusCode;
  }
}

export class PartnerRateLimitException extends PartnerApiException {
  readonly retryAfter?: string;

  constructor(message = 'Limite de requisições excedido na instituição parceira (HTTP 429)', retryAfter?: string) {
    super(message, 429);
    this.name = 'PartnerRateLimitException';
    this.retryAfter = retryAfter;
  }
}

export interface MockClientConfig {
  forceRateLimitOnPage?: number;
  rateLimitRetryAfterHeader?: string;
  forceErrorOnPage?: number;
  totalPages?: number;
  recordsPerPage?: number;
}

export class MockPartnerBankClient implements IPartnerBankClient {
  private config: MockClientConfig;

  constructor(config: MockClientConfig = {}) {
    this.config = {
      totalPages: 3,
      recordsPerPage: 5,
      ...config,
    };
  }

  setConfig(config: Partial<MockClientConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async fetchTransactionsPage(
    consentExternalId: string,
    page: number,
    pageSize?: number,
  ): Promise<PartnerPageResponse> {
    const totalPages = this.config.totalPages ?? 3;
    const recordsPerPage = pageSize ?? (this.config.recordsPerPage ?? 5);

    if (this.config.forceRateLimitOnPage === page) {
      throw new PartnerRateLimitException(
        'Limite de requisições excedido na instituição parceira (HTTP 429)',
        this.config.rateLimitRetryAfterHeader,
      );
    }

    if (this.config.forceErrorOnPage === page) {
      throw new PartnerApiException(
        `Erro interno temporário retornado pela instituição parceira na página ${page}`,
        500,
      );
    }

    if (page > totalPages) {
      return {
        data: {
          account: {
            externalId: `acc-ext-${consentExternalId}`,
            number: '12345-6',
            type: 'CHECKING',
          },
          transactions: [],
        },
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords: totalPages * recordsPerPage,
          hasNextPage: false,
        },
      };
    }

    const transactions = [];
    for (let i = 1; i <= recordsPerPage; i++) {
      const index = (page - 1) * recordsPerPage + i;
      transactions.push({
        externalId: `tx-ext-${consentExternalId}-${index}`,
        amount: (index * 25.5).toFixed(2),
        currency: 'BRL',
        bookingDate: new Date(Date.now() - index * 3600000).toISOString(),
        description: `Transação Mock ${index} para ${consentExternalId}`,
        status: 'POSTED',
      });
    }

    return {
      data: {
        account: {
          externalId: `acc-ext-${consentExternalId}`,
          number: '12345-6',
          type: 'CHECKING',
        },
        transactions,
      },
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords: totalPages * recordsPerPage,
        hasNextPage: page < totalPages,
      },
    };
  }
}
