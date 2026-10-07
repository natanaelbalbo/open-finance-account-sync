import { Injectable, Inject } from '@nestjs/common';
import { IQueueService } from '../../domain/ports/queue.port';
import {
  SyncConsentService,
  SyncExecutionResult,
} from '../../application/services/sync-consent.service';

//consumo de mensagens da fila
@Injectable()
export class SyncQueueConsumer {
  constructor(
    @Inject('IQueueService')
    private readonly queueService: IQueueService,
    private readonly syncService: SyncConsentService,
  ) { }

  async pollAndProcessBatch(): Promise<SyncExecutionResult[]> {
    const pending = await this.queueService.getPendingMessages();
    const results: SyncExecutionResult[] = [];

    for (const job of pending) {
      const result = await this.syncService.processSync(job);
      results.push(result);
    }

    return results;
  }
}
