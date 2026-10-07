import { Injectable, Inject } from '@nestjs/common';
import { IQueueService, SyncJobMessage } from '../../domain/ports/queue.port';
import { ISyncRepository } from '../../domain/ports/sync-repository.port';
import { IPartnerBankClient } from '../../domain/ports/partner-bank-client.port';
import { StructuredLoggerService } from '../../infrastructure/logging/structured-logger.service';
import { RateLimitHelper } from '../../infrastructure/partner-api/rate-limit.helper';
import { PartnerRateLimitException } from '../../infrastructure/partner-api/mock-partner-bank.client';
import { TransactionEntity } from '../../domain/entities/transaction.entity';
import { AccountEntity } from '../../domain/entities/account.entity';
import { randomUUID } from 'crypto';

export interface SyncExecutionResult {
  syncId: string;
  success: boolean;
  totalPagesProcessed: number;
  totalTransactionsInserted: number;
  totalDuplicatesIgnored: number;
  status: 'COMPLETED' | 'RATE_LIMITED' | 'FAILED' | 'INVALID_CONSENT';
  delayMs?: number;
}

@Injectable()
export class SyncConsentService {
  constructor(
    @Inject('ISyncRepository')
    private readonly repository: ISyncRepository,
    @Inject('IPartnerBankClient')
    private readonly partnerClient: IPartnerBankClient,
    @Inject('IQueueService')
    private readonly queueService: IQueueService,
    private readonly logger: StructuredLoggerService,
  ) { }

  async processSync(job: SyncJobMessage): Promise<SyncExecutionResult> {
    const syncId = randomUUID();
    const startTime = Date.now();

    this.logger.log(
      {
        syncId,
        messageId: job.messageId,
        consentId: job.consentId,
        institutionId: job.institutionId,
        step: 'INICIO_PROCESSAMENTO',
        attempt: job.attempt,
        status: 'STARTED',
      },
      'Iniciando processamento da sincronização de consentimento',
    );

    const consent = await this.repository.findConsentById(job.consentId);
    if (!consent) {
      this.logger.warn(
        {
          syncId,
          messageId: job.messageId,
          consentId: job.consentId,
          institutionId: job.institutionId,
          step: 'VALIDACAO_CONSENTIMENTO',
          attempt: job.attempt,
          durationMs: Date.now() - startTime,
          status: 'INVALID_CONSENT',
        },
        'Consentimento não encontrado na base de dados. Mensagem descartada.',
      );
      await this.queueService.ack(job.messageId);
      return {
        syncId,
        success: false,
        totalPagesProcessed: 0,
        totalTransactionsInserted: 0,
        totalDuplicatesIgnored: 0,
        status: 'INVALID_CONSENT',
      };
    }

    try {
      consent.validateCanSync();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'consentimento inválido.';
      this.logger.warn(
        {
          syncId,
          messageId: job.messageId,
          consentId: job.consentId,
          institutionId: job.institutionId,
          step: 'VALIDACAO_CONSENTIMENTO',
          attempt: job.attempt,
          durationMs: Date.now() - startTime,
          status: 'INVALID_CONSENT',
          details: { motivo: errorMessage },
        },
        'Consentimento inválido ou expirado. Mensagem confirmada para remoção.',
      );
      await this.queueService.ack(job.messageId);
      return {
        syncId,
        success: false,
        totalPagesProcessed: 0,
        totalTransactionsInserted: 0,
        totalDuplicatesIgnored: 0,
        status: 'INVALID_CONSENT',
      };
    }

    let currentPage = 1;
    let hasMorePages = true;
    let totalTransactionsInserted = 0;
    let totalDuplicatesIgnored = 0;
    let totalPagesProcessed = 0;

    try {
      while (hasMorePages) {
        const pageStartTime = Date.now();

        // Chamada HTTP, nenhuma conexão com banco de dados mantida aberta durante I/O de rede
        const pageResponse = await this.partnerClient.fetchTransactionsPage(
          consent.externalId,
          currentPage,
        );

        const partnerAccount = pageResponse.data.account;
        const account = await this.repository.findOrCreateAccount(
          new AccountEntity({
            clientId: consent.clientId,
            institutionId: consent.institutionId,
            externalId: partnerAccount.externalId,
            number: partnerAccount.number,
            type: partnerAccount.type,
          }),
        );

        await this.repository.associateConsentWithAccount(consent.id, account.id!);

        const transactionsToInsert: TransactionEntity[] = pageResponse.data.transactions.map(
          (t) =>
            new TransactionEntity({
              accountId: account.id!,
              externalId: t.externalId,
              amount: String(t.amount),
              currency: t.currency || 'BRL',
              transactionDate: new Date(t.bookingDate),
              description: t.description,
            }),
        );

        //persistência
        const insertResult = await this.repository.saveTransactionsBatch(transactionsToInsert);

        totalTransactionsInserted += insertResult.insertedCount;
        totalDuplicatesIgnored += insertResult.duplicateCount;
        totalPagesProcessed++;

        this.logger.log(
          {
            syncId,
            messageId: job.messageId,
            consentId: job.consentId,
            institutionId: job.institutionId,
            step: `PAGINA_${currentPage}`,
            attempt: job.attempt,
            durationMs: Date.now() - pageStartTime,
            status: 'IN_PROGRESS',
            details: {
              page: currentPage,
              inserted: insertResult.insertedCount,
              duplicates: insertResult.duplicateCount,
            },
          },
          `Página ${currentPage} processada e gravada com sucesso.`,
        );

        hasMorePages = pageResponse.pagination.hasNextPage;
        currentPage++;
      }

      // Todas as páginas foram concluídas: atualiza sincronização e confirma mensagem
      await this.repository.updateLastSuccessfulSync(consent.id, new Date());
      await this.queueService.ack(job.messageId);

      this.logger.log(
        {
          syncId,
          messageId: job.messageId,
          consentId: job.consentId,
          institutionId: job.institutionId,
          step: 'CONCLUSAO_SINCRONIZACAO',
          attempt: job.attempt,
          durationMs: Date.now() - startTime,
          status: 'COMPLETED',
          details: {
            totalPages: totalPagesProcessed,
            totalInserted: totalTransactionsInserted,
            totalDuplicates: totalDuplicatesIgnored,
          },
        },
        'Sincronização concluída com êxito em todas as páginas.',
      );

      return {
        syncId,
        success: true,
        totalPagesProcessed,
        totalTransactionsInserted,
        totalDuplicatesIgnored,
        status: 'COMPLETED',
      };
    } catch (error: unknown) {
      if (error instanceof PartnerRateLimitException) {
        const delayMs = RateLimitHelper.calculateRetryDelay(
          error.retryAfter,
          job.attempt,
        );

        this.logger.warn(
          {
            syncId,
            messageId: job.messageId,
            consentId: job.consentId,
            institutionId: job.institutionId,
            step: `RATE_LIMIT_PAGINA_${currentPage}`,
            attempt: job.attempt,
            durationMs: Date.now() - startTime,
            status: 'RATE_LIMITED',
            details: {
              delayMs,
              retryAfterHeader: error.retryAfter,
            },
          },
          `Limite 429 atingido. Interrompendo tentativa e agendando reprocessamento em ${delayMs}ms.`,
        );

        await this.queueService.nackWithDelay(
          job.messageId,
          delayMs,
          'Rate limit 429 na instituição parceira',
        );

        return {
          syncId,
          success: false,
          totalPagesProcessed,
          totalTransactionsInserted,
          totalDuplicatesIgnored,
          status: 'RATE_LIMITED',
          delayMs,
        };
      }

      // Falha genérica (timeout, erro 500, etc.)
      const backoffDelay = RateLimitHelper.calculateRetryDelay(null, job.attempt);
      const errInstance = error instanceof Error ? error : new Error(String(error));

      this.logger.error(
        {
          syncId,
          messageId: job.messageId,
          consentId: job.consentId,
          institutionId: job.institutionId,
          step: `FALHA_PROCESSAMENTO_PAGINA_${currentPage}`,
          attempt: job.attempt,
          durationMs: Date.now() - startTime,
          status: 'FAILED',
          details: {
            backoffDelay,
            registrosSalvosAteFalha: totalTransactionsInserted,
          },
        },
        `Erro durante o processamento da página ${currentPage}. Registros anteriores preservados no banco.`,
        errInstance,
      );

      await this.queueService.nackWithDelay(
        job.messageId,
        backoffDelay,
        errInstance.message || 'Erro inesperado na sincronização',
      );

      return {
        syncId,
        success: false,
        totalPagesProcessed,
        totalTransactionsInserted,
        totalDuplicatesIgnored,
        status: 'FAILED',
        delayMs: backoffDelay,
      };
    }
  }
}
