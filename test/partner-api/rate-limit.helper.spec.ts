import { RateLimitHelper } from '../../src/infrastructure/partner-api/rate-limit.helper';

describe('RateLimitHelper', () => {
  it('deve converter Retry-After em segundos para milissegundos', () => {
    const delay = RateLimitHelper.calculateRetryDelay('15', 1);
    expect(delay).toBe(15000);
  });

  it('deve converter Retry-After em formato HTTP-Date para delta em milissegundos', () => {
    const futureDate = new Date(Date.now() + 20000).toUTCString();
    const delay = RateLimitHelper.calculateRetryDelay(futureDate, 1);
    expect(delay).toBeGreaterThanOrEqual(19000);
    expect(delay).toBeLessThanOrEqual(21000);
  });

  it('deve calcular backoff rogressivo quando Retry-After for ausente', () => {
    const delayAttempt1 = RateLimitHelper.calculateRetryDelay(null, 1, {
      baseBackoffMs: 1000,
      maxBackoffMs: 10000,
    });
    const delayAttempt2 = RateLimitHelper.calculateRetryDelay(null, 2, {
      baseBackoffMs: 1000,
      maxBackoffMs: 10000,
    });
    const delayAttempt3 = RateLimitHelper.calculateRetryDelay(null, 3, {
      baseBackoffMs: 1000,
      maxBackoffMs: 10000,
    });

    expect(delayAttempt1).toBeGreaterThanOrEqual(1000);
    expect(delayAttempt2).toBeGreaterThanOrEqual(2000);
    expect(delayAttempt3).toBeGreaterThanOrEqual(4000);
  });

  it('deve respeitar o teto mximo de backoff configurado', () => {
    const delay = RateLimitHelper.calculateRetryDelay(null, 10, {
      baseBackoffMs: 1000,
      maxBackoffMs: 8000,
    });
    expect(delay).toBeLessThanOrEqual(8000);
  });
});
