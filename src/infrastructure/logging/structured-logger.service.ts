import { Injectable } from '@nestjs/common';

export interface LogContext {
  syncId: string;
  messageId: string;
  consentId: string;
  institutionId?: string;
  step: string;
  attempt?: number;
  durationMs?: number;
  status:
    | 'STARTED'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'RATE_LIMITED'
    | 'FAILED'
    | 'RETRY_SCHEDULED'
    | 'INVALID_CONSENT';
  details?: Record<string, unknown>;
}

@Injectable()
export class StructuredLoggerService {
  log(context: LogContext, message: string): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      sync_id: context.syncId,
      message_id: context.messageId,
      consent_id: context.consentId,
      institution_id: context.institutionId || 'N/A',
      step: context.step,
      attempt: context.attempt ?? 1,
      duration_ms: context.durationMs ?? 0,
      status: context.status,
      ...(context.details ? { details: context.details } : {}),
    };

    console.log(JSON.stringify(entry));
  }

  warn(context: LogContext, message: string): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message,
      sync_id: context.syncId,
      message_id: context.messageId,
      consent_id: context.consentId,
      institution_id: context.institutionId || 'N/A',
      step: context.step,
      attempt: context.attempt ?? 1,
      duration_ms: context.durationMs ?? 0,
      status: context.status,
      ...(context.details ? { details: context.details } : {}),
    };

    console.warn(JSON.stringify(entry));
  }

  error(context: LogContext, message: string, error?: Error): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      sync_id: context.syncId,
      message_id: context.messageId,
      consent_id: context.consentId,
      institution_id: context.institutionId || 'N/A',
      step: context.step,
      attempt: context.attempt ?? 1,
      duration_ms: context.durationMs ?? 0,
      status: context.status,
      error_name: error?.name,
      error_message: error?.message,
      ...(context.details ? { details: context.details } : {}),
    };

    console.error(JSON.stringify(entry));
  }
}
