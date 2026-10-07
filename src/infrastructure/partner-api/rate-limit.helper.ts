//configuracao de tempo de reenvio em caso de rate limit
export interface RateLimitOptions {
  baseBackoffMs?: number;
  maxBackoffMs?: number;
}

export class RateLimitHelper {
  private static readonly DEFAULT_BASE_BACKOFF_MS = 1000;
  private static readonly DEFAULT_MAX_BACKOFF_MS = 30000;

  static calculateRetryDelay(
    retryAfterHeader: string | null | undefined,
    attempt: number,
    options: RateLimitOptions = {},
  ): number {
    const envBase = Number(process.env.QUEUE_BASE_BACKOFF_MS);
    const envMax = Number(process.env.QUEUE_MAX_BACKOFF_MS);
    const baseBackoff = options.baseBackoffMs ?? (isNaN(envBase) ? 1000 : envBase);
    const maxBackoff = options.maxBackoffMs ?? (isNaN(envMax) ? 30000 : envMax);

    if (retryAfterHeader && retryAfterHeader.trim().length > 0) {
      const trimmed = retryAfterHeader.trim();

      const seconds = Number(trimmed);
      if (!isNaN(seconds) && seconds >= 0) {
        return Math.min(seconds * 1000, maxBackoff * 2);
      }

      const parsedDate = Date.parse(trimmed);
      if (!isNaN(parsedDate)) {
        const deltaMs = parsedDate - Date.now();
        return Math.max(1000, Math.min(deltaMs, maxBackoff * 2));
      }
    }

    const exponential = baseBackoff * Math.pow(2, Math.max(0, attempt - 1));
    const cappedExponential = Math.min(exponential, maxBackoff);
    const jitter = Math.floor(Math.random() * (cappedExponential * 0.3));

    return Math.min(cappedExponential + jitter, maxBackoff);
  }
}
