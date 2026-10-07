export interface SyncJobMessage {
  messageId: string;
  consentId: string;
  clientId: string;
  institutionId: string;
  attempt: number;
  enqueuedAt: Date;
  nextExecutionAt?: Date;
}

//gerenciamento de mensagens de sincronização
export interface IQueueService {
  publish(job: SyncJobMessage): Promise<void>;
  ack(messageId: string): Promise<void>;
  nackWithDelay(messageId: string, delayMs: number, reason: string): Promise<void>;
  sendToDlq(job: SyncJobMessage, reason: string): Promise<void>;
  getPendingMessages(): Promise<SyncJobMessage[]>;
  getDlqMessages(): Promise<{ job: SyncJobMessage; reason: string; timestamp: Date }[]>;
}
