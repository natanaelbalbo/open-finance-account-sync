import { createMockPrismaService } from '../helpers/prisma-mock.helper';
import { SyncPostgresRepository } from '../../src/infrastructure/database/sync-postgres.repository';
import { TransactionQueryRepository } from '../../src/infrastructure/database/transaction-query.repository';
import { AccountEntity } from '../../src/domain/entities/account.entity';
import { TransactionEntity } from '../../src/domain/entities/transaction.entity';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

describe('Testes de Integração com Prisma e Constraints do PostgreSQL', () => {
  let mockPrisma: PrismaService;
  let syncRepo: SyncPostgresRepository;
  let queryRepo: TransactionQueryRepository;

  beforeAll(async () => {
    mockPrisma = createMockPrismaService();
    syncRepo = new SyncPostgresRepository(mockPrisma);
    queryRepo = new TransactionQueryRepository(mockPrisma);
  });

  afterAll(async () => {
    await mockPrisma.$disconnect();
  });

  beforeEach(() => {
    (mockPrisma as any)._clear();
  });

  it('deve garantir que reprocessar a mesma mensagem não duplica lançamentos via skipDuplicates do Prisma', async () => {
    const account = await syncRepo.findOrCreateAccount(
      new AccountEntity({
        clientId: 'cli-001',
        institutionId: 'bank-test',
        externalId: 'acc-ext-01',
        number: '12345-6',
      }),
    );

    const txs = [
      new TransactionEntity({
        accountId: account.id!,
        externalId: 'tx-001',
        amount: '100.50',
        transactionDate: new Date('2026-03-01T10:00:00Z'),
        description: 'Primeira carga',
      }),
      new TransactionEntity({
        accountId: account.id!,
        externalId: 'tx-002',
        amount: '200.00',
        transactionDate: new Date('2026-03-01T11:00:00Z'),
        description: 'Segunda carga',
      }),
    ];

    // Primeira execução
    const firstRun = await syncRepo.saveTransactionsBatch(txs);
    expect(firstRun.insertedCount).toBe(2);
    expect(firstRun.duplicateCount).toBe(0);

    // Segunda execução da mesma mensagem
    const secondRun = await syncRepo.saveTransactionsBatch(txs);
    expect(secondRun.insertedCount).toBe(0);
    expect(secondRun.duplicateCount).toBe(2);

    // Verificação de registros persistidos na tabela
    const totalCount = await mockPrisma.transaction.count({
      where: { accountId: account.id! },
    });
    expect(totalCount).toBe(2);
  });

  it('deve suportar processamentos simultâneos concorrentes sem gerar duplicidade (Promise.all)', async () => {
    const account = await syncRepo.findOrCreateAccount(
      new AccountEntity({
        clientId: 'cli-002',
        institutionId: 'bank-test',
        externalId: 'acc-ext-02',
      }),
    );

    const txs = [
      new TransactionEntity({
        accountId: account.id!,
        externalId: 'tx-conc-1',
        amount: '50.00',
        transactionDate: new Date('2026-03-02T10:00:00Z'),
        description: 'Transação Concorrente 1',
      }),
      new TransactionEntity({
        accountId: account.id!,
        externalId: 'tx-conc-2',
        amount: '75.25',
        transactionDate: new Date('2026-03-02T10:05:00Z'),
        description: 'Transação Concorrente 2',
      }),
    ];

    // Simula 5 workers concorrentes recebendo a mesma mensagem simultaneamente
    const workers = [
      syncRepo.saveTransactionsBatch(txs),
      syncRepo.saveTransactionsBatch(txs),
      syncRepo.saveTransactionsBatch(txs),
      syncRepo.saveTransactionsBatch(txs),
      syncRepo.saveTransactionsBatch(txs),
    ];

    const results = await Promise.all(workers);

    const totalInseridos = results.reduce((acc, curr) => acc + curr.insertedCount, 0);
    expect(totalInseridos).toBe(2);

    const totalCount = await mockPrisma.transaction.count({
      where: { accountId: account.id! },
    });
    expect(totalCount).toBe(2);
  });

  it('deve preservar transações legítimas com mesmo valor e mesma data, mas IDs externos diferentes', async () => {
    const account = await syncRepo.findOrCreateAccount(
      new AccountEntity({
        clientId: 'cli-003',
        institutionId: 'bank-test',
        externalId: 'acc-ext-03',
      }),
    );

    const sameDate = new Date('2026-03-03T15:00:00Z');
    const txs = [
      new TransactionEntity({
        accountId: account.id!,
        externalId: 'tx-cupom-fiscal-A',
        amount: '35.00',
        transactionDate: sameDate,
        description: 'Cafeteria A',
      }),
      new TransactionEntity({
        accountId: account.id!,
        externalId: 'tx-cupom-fiscal-B',
        amount: '35.00',
        transactionDate: sameDate,
        description: 'Cafeteria B',
      }),
    ];

    const res = await syncRepo.saveTransactionsBatch(txs);
    expect(res.insertedCount).toBe(2);
    expect(res.duplicateCount).toBe(0);

    const totalCount = await mockPrisma.transaction.count({
      where: { accountId: account.id! },
    });
    expect(totalCount).toBe(2);
  });

  it('deve permitir completar os dados na tentativa seguinte após falha parcial de páginas', async () => {
    const account = await syncRepo.findOrCreateAccount(
      new AccountEntity({
        clientId: 'cli-004',
        institutionId: 'bank-test',
        externalId: 'acc-ext-04',
      }),
    );

    const page1Txs = [
      new TransactionEntity({
        accountId: account.id!,
        externalId: 'tx-p1-1',
        amount: '10.00',
        transactionDate: new Date('2026-03-04T08:00:00Z'),
        description: 'Item 1 Página 1',
      }),
    ];

    const page2Txs = [
      new TransactionEntity({
        accountId: account.id!,
        externalId: 'tx-p2-1',
        amount: '20.00',
        transactionDate: new Date('2026-03-04T09:00:00Z'),
        description: 'Item 1 Página 2',
      }),
    ];

    // Tentativa 1: Página 1 é salva, mas ocorre falha antes da Página 2
    const run1 = await syncRepo.saveTransactionsBatch(page1Txs);
    expect(run1.insertedCount).toBe(1);

    // Tentativa 2: Página 1 é ignorada pelo skipDuplicates e Página 2 é inserida
    const retryPage1 = await syncRepo.saveTransactionsBatch(page1Txs);
    expect(retryPage1.insertedCount).toBe(0);
    expect(retryPage1.duplicateCount).toBe(1);

    const retryPage2 = await syncRepo.saveTransactionsBatch(page2Txs);
    expect(retryPage2.insertedCount).toBe(1);
    expect(retryPage2.duplicateCount).toBe(0);

    const totalCount = await mockPrisma.transaction.count({
      where: { accountId: account.id! },
    });
    expect(totalCount).toBe(2);
  });

  it('deve listar lançamentos com paginação por cursor decrescente e isolamento por cliente via Prisma', async () => {
    const accountClientA = await syncRepo.findOrCreateAccount(
      new AccountEntity({
        clientId: 'cliente-autorizado',
        institutionId: 'bank-a',
        externalId: 'acc-a-1',
      }),
    );

    const accountClientB = await syncRepo.findOrCreateAccount(
      new AccountEntity({
        clientId: 'outro-cliente',
        institutionId: 'bank-b',
        externalId: 'acc-b-1',
      }),
    );

    const txA1 = new TransactionEntity({
      accountId: accountClientA.id!,
      externalId: 'tx-a-1',
      amount: '100.00',
      transactionDate: new Date('2026-03-01T10:00:00Z'),
      description: 'Lançamento 1 Cliente A',
    });
    const txA2 = new TransactionEntity({
      accountId: accountClientA.id!,
      externalId: 'tx-a-2',
      amount: '200.00',
      transactionDate: new Date('2026-03-02T10:00:00Z'),
      description: 'Lançamento 2 Cliente A',
    });
    const txA3 = new TransactionEntity({
      accountId: accountClientA.id!,
      externalId: 'tx-a-3',
      amount: '300.00',
      transactionDate: new Date('2026-03-03T10:00:00Z'),
      description: 'Lançamento 3 Cliente A',
    });

    const txB1 = new TransactionEntity({
      accountId: accountClientB.id!,
      externalId: 'tx-b-1',
      amount: '999.00',
      transactionDate: new Date('2026-03-04T10:00:00Z'),
      description: 'Lançamento Secreto Cliente B',
    });

    await syncRepo.saveTransactionsBatch([txA1, txA2, txA3, txB1]);

    // Primeira página do cliente A (limit = 2)
    const page1 = await queryRepo.getStatementByClient({
      clientId: 'cliente-autorizado',
      limit: 2,
    });

    expect(page1.data.length).toBe(2);
    expect(page1.pagination.hasMore).toBe(true);
    expect(page1.data[0].amount).toBe('300.00'); // Mais recente primeiro
    expect(page1.data[1].amount).toBe('200.00');
    expect(page1.pagination.nextCursor).toBeDefined();

    // Segunda página usando cursor
    const page2 = await queryRepo.getStatementByClient({
      clientId: 'cliente-autorizado',
      limit: 2,
      cursorId: page1.pagination.nextCursor!.id,
    });

    expect(page2.data.length).toBe(1);
    expect(page2.data[0].amount).toBe('100.00');
    expect(page2.pagination.hasMore).toBe(false);

    // Garantir isolamento do cliente B
    const allA = [...page1.data, ...page2.data];
    const leakedB = allA.some((item) => item.description.includes('Cliente B'));
    expect(leakedB).toBe(false);
  });
});
