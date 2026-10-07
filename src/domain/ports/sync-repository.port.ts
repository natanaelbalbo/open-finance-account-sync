import { ConsentEntity } from '../entities/consent.entity';
import { AccountEntity } from '../entities/account.entity';
import { TransactionEntity } from '../entities/transaction.entity';

export interface BatchInsertResult {
  insertedCount: number;
  duplicateCount: number;
}

//persistencia de dados na sincronização
export interface ISyncRepository {
  findConsentById(consentId: string): Promise<ConsentEntity | null>;
  findOrCreateAccount(account: AccountEntity): Promise<AccountEntity>;
  associateConsentWithAccount(consentId: string, accountId: string): Promise<void>;
  saveTransactionsBatch(transactions: TransactionEntity[]): Promise<BatchInsertResult>;
  updateLastSuccessfulSync(consentId: string, syncDate: Date): Promise<void>;
}
