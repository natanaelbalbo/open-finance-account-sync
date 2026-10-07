import { SyncConsentService } from '../../src/application/services/sync-consent.service';
import { ISyncRepository } from '../../src/domain/ports/sync-repository.port';
import { IQueueService, SyncJobMessage } from '../../src/domain/ports/queue.port';
import { MockPartnerBankClient } from '../../src/infrastructure/partner-api/mock-partner-bank.client';
import { StructuredLoggerService } from '../../src/infrastructure/logging/structured-logger.service';
import { ConsentEntity } from '../../src/domain/entities/consent.entity';
import { AccountEntity } from '../../src/domain/entities/account.entity';
import { TransactionEntity } from '../../src/domain/entities/transaction.entity';
import { ConsentStatus } from '../../src/domain/types/financial-types';

describe('SyncConsentService (Testes de Fluxo e Resiliência)', () => {
  let service: SyncConsentService;
  let mockRepo: jest.Mocked<ISyncRepository>;
  let mockQueue: jest.Mocked<IQueueService>;
  let partnerClient: MockPartnerBankClient;
  let logger: StructuredLoggerService;

  const validConsent = new ConsentEntity({
    id: 'c-100',
    clientId: 'cli-001',
    institutionId: 'bank-alpha',
    externalId: 'ext-c-alpha',
    status: ConsentStatus.ACTIVE,
    expiresAt: new Date(Date.now() + 86400000),
  });

  const baseJob: SyncJobMessage = {
    messageId: 'msg-sync-1',
    consentId: 'c-100',
    clientId: 'cli-001',
    institutionId: 'bank-alpha',
    attempt: 1,
    enqueuedAt: new Date(),
  };

  beforeEach(() => {
    partnerClient = new MockPartnerBankClient({
      totalPages: 2,
      recordsPerPage: 3,
    });

    mockRepo = {
      findConsentById: jest.fn().mockResolvedValue(validConsent),
      findOrCreateAccount: jest.fn().mockImplementation(async (acc: AccountEntity) => {
        return new AccountEntity({ ...acc, id: 'acc-uuid-1' });
      }),
      associateConsentWithAccount: jest.fn().mockResolvedValue(undefined),
      saveTransactionsBatch: jest.fn().mockResolvedValue({ insertedCount: 3, duplicateCount: 0 }),
      updateLastSuccessfulSync: jest.fn().mockResolvedValue(undefined),
    };

    mockQueue = {
      publish: jest.fn().mockResolvedValue(undefined),
      ack: jest.fn().mockResolvedValue(undefined),
      nackWithDelay: jest.fn().mockResolvedValue(undefined),
      sendToDlq: jest.fn().mockResolvedValue(undefined),
      getPendingMessages: jest.fn().mockResolvedValue([]),
      getDlqMessages: jest.fn().mockResolvedValue([]),
    };

    logger = new StructuredLoggerService();
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'warn').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });

    service = new SyncConsentService(mockRepo, partnerClient, mockQueue, logger);
  });

  it('deve sincronizar todas as páginas com sucesso, gravar trnsacoes, atualizar última sincronização e dar ACK', async () => {
    const result = await service.processSync(baseJob);

    expect(result.success).toBe(true);
    expect(result.status).toBe('COMPLETED');
    expect(result.totalPagesProcessed).toBe(2);
    expect(mockRepo.saveTransactionsBatch).toHaveBeenCalledTimes(2);
    expect(mockRepo.updateLastSuccessfulSync).toHaveBeenCalledWith('c-100', expect.any(Date));
    expect(mockQueue.ack).toHaveBeenCalledWith('msg-sync-1');
    expect(mockQueue.nackWithDelay).not.toHaveBeenCalled();
  });

  it('deve interromper ao receber HTTP 429 com Retry-After numérico, agendar retry com delay e NÃO dar ACK', async () => {
    partnerClient.setConfig({
      forceRateLimitOnPage: 1,
      rateLimitRetryAfterHeader: '45',
    });

    const result = await service.processSync(baseJob);

    expect(result.success).toBe(false);
    expect(result.status).toBe('RATE_LIMITED');
    expect(result.delayMs).toBe(45000);
    expect(mockQueue.nackWithDelay).toHaveBeenCalledWith(
      'msg-sync-1',
      45000,
      expect.stringContaining('Rate limit 429'),
    );
    expect(mockQueue.ack).not.toHaveBeenCalled();
    expect(mockRepo.updateLastSuccessfulSync).not.toHaveBeenCalled();
  });

  it('deve agendar retry progressivo com jitter quando receber HTTP 429 sem Retry-After', async () => {
    partnerClient.setConfig({
      forceRateLimitOnPage: 1,
      rateLimitRetryAfterHeader: undefined,
    });

    const result = await service.processSync(baseJob);

    expect(result.success).toBe(false);
    expect(result.status).toBe('RATE_LIMITED');
    expect(result.delayMs).toBeGreaterThanOrEqual(1000);
    expect(mockQueue.nackWithDelay).toHaveBeenCalled();
    expect(mockQueue.ack).not.toHaveBeenCalled();
  });

  it('deve manter registros da página 1 salvos e NÃO atualizar data ao falhar na página 2', async () => {
    partnerClient.setConfig({
      forceErrorOnPage: 2,
    });

    const result = await service.processSync(baseJob);

    expect(result.success).toBe(false);
    expect(result.status).toBe('FAILED');
    expect(result.totalPagesProcessed).toBe(1);
    expect(mockRepo.saveTransactionsBatch).toHaveBeenCalledTimes(1);
    expect(mockRepo.updateLastSuccessfulSync).not.toHaveBeenCalled();
    expect(mockQueue.nackWithDelay).toHaveBeenCalledWith(
      'msg-sync-1',
      expect.any(Number),
      expect.stringContaining('página 2'),
    );
  });

  it('deve descartar com ACK e registrar log quando consentimento for inválido ou expirado', async () => {
    const expiredConsent = new ConsentEntity({
      id: 'c-exp',
      clientId: 'cli-001',
      institutionId: 'bank-alpha',
      externalId: 'ext-c-alpha',
      status: ConsentStatus.EXPIRED,
      expiresAt: new Date(Date.now() - 3600000),
    });

    mockRepo.findConsentById.mockResolvedValueOnce(expiredConsent);

    const result = await service.processSync(baseJob);

    expect(result.success).toBe(false);
    expect(result.status).toBe('INVALID_CONSENT');
    expect(mockQueue.ack).toHaveBeenCalledWith('msg-sync-1');
    expect(mockRepo.saveTransactionsBatch).not.toHaveBeenCalled();
  });
});
