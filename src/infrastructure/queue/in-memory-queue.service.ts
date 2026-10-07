import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IQueueService, SyncJobMessage } from '../../domain/ports/queue.port';

@Injectable()
export class InMemoryQueueService implements IQueueService {
  private queue: SyncJobMessage[] = [];
  private dlq: { job: SyncJobMessage; reason: string; timestamp: Date }[] = [];
  private maxRetries: number;

  constructor(@Optional() private readonly configService?: ConfigService) {
    const envMax = Number(
      this.configService?.get<string>('QUEUE_MAX_ATTEMPTS') ??
        process.env.QUEUE_MAX_ATTEMPTS,
    );
    this.maxRetries = isNaN(envMax) || envMax <= 0 ? 3 : envMax;
  }

  setMaxRetries(max: number): void {
    this.maxRetries = max;
  }

  async publish(job: SyncJobMessage): Promise<void> {
    this.queue.push({ ...job });
  }

  async ack(messageId: string): Promise<void> {
    this.queue = this.queue.filter((m) => m.messageId !== messageId);
  }

  async nackWithDelay(messageId: string, delayMs: number, reason: string): Promise<void> {
    const index = this.queue.findIndex((m) => m.messageId === messageId);
    if (index === -1) return;

    const currentMsg = this.queue[index];
    const newAttempt = (currentMsg.attempt || 1) + 1;

    if (newAttempt > this.maxRetries) {
      await this.sendToDlq(
        { ...currentMsg, attempt: newAttempt },
        `Limite de ${this.maxRetries} tentativas excedido. Motivo: ${reason}`,
      );
      this.queue.splice(index, 1);
      return;
    }

    const updatedJob: SyncJobMessage = {
      ...currentMsg,
      attempt: newAttempt,
      nextExecutionAt: new Date(Date.now() + delayMs),
    };

    this.queue[index] = updatedJob;
  }

  async sendToDlq(job: SyncJobMessage, reason: string): Promise<void> {
    this.dlq.push({
      job: { ...job },
      reason,
      timestamp: new Date(),
    });
  }

  async getPendingMessages(): Promise<SyncJobMessage[]> {
    const now = Date.now();
    return this.queue.filter(
      (m) => !m.nextExecutionAt || m.nextExecutionAt.getTime() <= now,
    );
  }

  async getDlqMessages(): Promise<{ job: SyncJobMessage; reason: string; timestamp: Date }[]> {
    return [...this.dlq];
  }

  async getAllMessages(): Promise<SyncJobMessage[]> {
    return [...this.queue];
  }
}
