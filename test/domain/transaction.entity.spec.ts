import { TransactionEntity } from '../../src/domain/entities/transaction.entity';
import { TransactionStatus } from '../../src/domain/types/financial-types';
import { InvalidTransactionDataException } from '../../src/domain/exceptions/domain.exceptions';

describe('TransactionEntity & Normalização', () => {
  it('deve normalizar valores com vírgula ou ponto para string com 2 casas decimais', () => {
    const tx1 = new TransactionEntity({
      accountId: 'acc-1',
      externalId: 'ext-tx-1',
      amount: '1500,5',
      currency: 'BRL',
      transactionDate: new Date('2026-03-10T12:00:00Z'),
      description: ' TED Recebida ',
    });

    expect(tx1.amount).toBe('1500.50');
    expect(tx1.description).toBe('TED Recebida');
    expect(tx1.currency).toBe('BRL');
    expect(tx1.status).toBe(TransactionStatus.POSTED);
  });

  it('deve formatar valores inteiros com duas casas decimais', () => {
    const tx = new TransactionEntity({
      accountId: 'acc-1',
      externalId: 'ext-tx-2',
      amount: '200',
      transactionDate: new Date(),
      description: 'PIX',
    });

    expect(tx.amount).toBe('200.00');
  });

  it('deve permitir valores negativos para débitos sem perder sinal', () => {
    const tx = new TransactionEntity({
      accountId: 'acc-1',
      externalId: 'ext-tx-3',
      amount: '-49.9',
      transactionDate: new Date(),
      description: 'Compra no Débito',
    });

    expect(tx.amount).toBe('-49.90');
  });

  it('deve lançar exceção ao receber formato numérico inválido', () => {
    expect(() => {
      new TransactionEntity({
        accountId: 'acc-1',
        externalId: 'ext-tx-4',
        amount: 'abc',
        transactionDate: new Date(),
        description: 'Invalido',
      });
    }).toThrow(InvalidTransactionDataException);
  });

  it('deve lançar exceção se externalId ou accountId estiverem vazios', () => {
    expect(() => {
      new TransactionEntity({
        accountId: '',
        externalId: 'ext-tx-5',
        amount: '10.00',
        transactionDate: new Date(),
        description: 'Sem conta',
      });
    }).toThrow(InvalidTransactionDataException);

    expect(() => {
      new TransactionEntity({
        accountId: 'acc-1',
        externalId: '   ',
        amount: '10.00',
        transactionDate: new Date(),
        description: 'Sem id externo',
      });
    }).toThrow(InvalidTransactionDataException);
  });
});
