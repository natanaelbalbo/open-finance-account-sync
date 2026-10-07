import { InMemoryQueueService } from '../../src/infrastructure/queue/in-memory-queue.service';
import { SyncJobMessage } from '../../src/domain/ports/queue.port';

describe('InMemoryQueueService', () => {
  let queue: InMemoryQueueService;

  beforeEach(() => {
    queue = new InMemoryQueueService();
    queue.setMaxRetries(3);
  });

  const sampleJob: SyncJobMessage = {
    messageId: 'msg-01',
    consentId: 'consent-01',
    clientId: 'cli-01',
    institutionId: 'bank-01',
    attempt: 1,
    enqueuedAt: new Date(),
  };

  it('deve publicar e listar mensagens pendentes', async () => {
    await queue.publish(sampleJob);
    const pendentes = await queue.getPendingMessages();
    expect(pendentes.length).toBe(1);
    expect(pendentes[0].messageId).toBe('msg-01');
  });

  it('deve remover a mensagem ao receber ACK de confirmação', async () => {
    await queue.publish(sampleJob);
    await queue.ack('msg-01');
    const pendentes = await queue.getPendingMessages();
    expect(pendentes.length).toBe(0);
  });

  it('deve incrementar a tentativa e aplicar delay ao receber NACK', async () => {
    await queue.publish(sampleJob);
    await queue.nackWithDelay('msg-01', 5000, 'HTTP 429');

    const pendentesImediatos = await queue.getPendingMessages();
    expect(pendentesImediatos.length).toBe(0);

    const todas = await queue.getAllMessages();
    expect(todas.length).toBe(1);
    expect(todas[0].attempt).toBe(2);
    expect(todas[0].nextExecutionAt).toBeDefined();
  });

  it('deve encaminhar para a DLQ quando exceder o limite de retries', async () => {
    await queue.publish({ ...sampleJob, attempt: 3 });
    await queue.nackWithDelay('msg-01', 1000, 'Falha definitiva');

    const pendentes = await queue.getPendingMessages();
    expect(pendentes.length).toBe(0);

    const dlq = await queue.getDlqMessages();
    expect(dlq.length).toBe(1);
    expect(dlq[0].job.messageId).toBe('msg-01');
    expect(dlq[0].reason).toContain('Limite de 3 tentativas excedido');
  });
});
