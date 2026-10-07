import { AccountStatementController } from '../../src/presentation/controllers/account-statement.controller';
import { TransactionQueryRepository } from '../../src/infrastructure/database/transaction-query.repository';
import { UnauthorizedException } from '@nestjs/common';

describe('AccountStatementController', () => {
  let controller: AccountStatementController;
  let mockQueryRepo: jest.Mocked<TransactionQueryRepository>;

  beforeEach(() => {
    mockQueryRepo = {
      getStatementByClient: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'tx-1',
            accountId: 'acc-1',
            externalId: 'ext-tx-1',
            amount: '150.00',
            currency: 'BRL',
            transactionDate: '2026-03-10T12:00:00.000Z',
            description: 'Pagamento Fornecedor',
            status: 'POSTED',
          },
        ],
        pagination: {
          limit: 20,
          hasMore: false,
          nextCursor: null,
        },
      }),
    } as any;

    controller = new AccountStatementController(mockQueryRepo);
  });

  it('deve retornar lançamentos do cliente com sucesso x-client-id', async () => {
    const result = await controller.getStatement('cli-123');

    expect(result.data.length).toBe(1);
    expect(mockQueryRepo.getStatementByClient).toHaveBeenCalledWith({
      clientId: 'cli-123',
      limit: 20,
      cursorDate: undefined,
      cursorId: undefined,
    });
  });

  it('deve repassar cursor de paginação quando fornecido', async () => {
    await controller.getStatement('cli-123', undefined, '10', '2026-03-10T12:00:00.000Z', 'tx-1');

    expect(mockQueryRepo.getStatementByClient).toHaveBeenCalledWith({
      clientId: 'cli-123',
      limit: 10,
      cursorDate: '2026-03-10T12:00:00.000Z',
      cursorId: 'tx-1',
    });
  });

  it('deve lançar UnauthorizedException caso a identificação do cliente não seja fornecida', async () => {
    await expect(controller.getStatement(undefined, undefined)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
