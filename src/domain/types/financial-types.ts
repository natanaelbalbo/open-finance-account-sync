//status de consentimento
export enum ConsentStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
  SUSPENDED = 'SUSPENDED',
}

export enum TransactionStatus {
  POSTED = 'POSTED',
  PENDING = 'PENDING',
}

export interface PartnerTransactionPayload {
  externalId: string;
  amount: string | number;
  currency?: string;
  bookingDate: string;
  description: string;
  status?: string;
}

export interface PartnerAccountPayload {
  externalId: string;
  number?: string;
  type?: string;
}

export interface PartnerPageResponse {
  data: {
    account: PartnerAccountPayload;
    transactions: PartnerTransactionPayload[];
  };
  pagination: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    hasNextPage: boolean;
  };
}
