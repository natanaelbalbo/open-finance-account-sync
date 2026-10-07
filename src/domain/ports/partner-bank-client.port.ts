import { PartnerPageResponse } from '../types/financial-types';

export interface IPartnerBankClient {
  fetchTransactionsPage(
    consentExternalId: string,
    page: number,
    pageSize?: number,
  ): Promise<PartnerPageResponse>;
}
