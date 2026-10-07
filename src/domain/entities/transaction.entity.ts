import { TransactionStatus } from '../types/financial-types';
import { InvalidTransactionDataException } from '../exceptions/domain.exceptions';

export interface TransactionProps {
  id?: string;
  accountId: string;
  externalId: string;
  amount: string;
  currency?: string;
  transactionDate: Date;
  description: string;
  status?: TransactionStatus;
  createdAt?: Date;
}

export class TransactionEntity {
  readonly id?: string;
  readonly accountId: string;
  readonly externalId: string;
  readonly amount: string;
  readonly currency: string;
  readonly transactionDate: Date;
  readonly description: string;
  readonly status: TransactionStatus;
  readonly createdAt: Date;

  constructor(props: TransactionProps) {
    if (!props.accountId) {
      throw new InvalidTransactionDataException('Identificador da conta eh obrigatório.');
    }
    if (!props.externalId || props.externalId.trim().length === 0) {
      throw new InvalidTransactionDataException('ID externo da transação é obrigatório.');
    }

    this.id = props.id;
    this.accountId = props.accountId;
    this.externalId = props.externalId.trim();
    this.amount = TransactionEntity.normalizeAmount(props.amount);
    this.currency = (props.currency ?? 'BRL').trim().toUpperCase();
    this.transactionDate = props.transactionDate;
    this.description = props.description?.trim() || 'Lançamento sem descrição';
    this.status = props.status ?? TransactionStatus.POSTED;
    this.createdAt = props.createdAt ?? new Date();
  }

  static normalizeAmount(rawAmount: string | number): string {
    if (rawAmount === null || rawAmount === undefined) {
      throw new InvalidTransactionDataException('Valor do lancamento não pode ser nulo.');
    }

    let parsed = String(rawAmount).trim().replace(',', '.');
    const regex = /^-?\d+(\.\d{1,4})?$/;
    if (!regex.test(parsed)) {
      throw new InvalidTransactionDataException(`Formato numerico inválido para o valor: ${rawAmount}`);
    }

    const parts = parsed.split('.');
    const integerPart = parts[0];
    const decimalPart = (parts[1] || '').padEnd(2, '0').slice(0, 2);
    return `${integerPart}.${decimalPart}`;
  }
}
