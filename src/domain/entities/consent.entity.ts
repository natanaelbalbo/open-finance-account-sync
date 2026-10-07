import { ConsentStatus } from '../types/financial-types';
import {
  ConsentExpiredException,
  ConsentInactiveException,
} from '../exceptions/domain.exceptions';

export interface ConsentProps {
  id: string;
  clientId: string;
  institutionId: string;
  externalId: string;
  status: ConsentStatus;
  expiresAt: Date;
  lastSuccessfulSyncAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ConsentEntity {
  readonly id: string;
  readonly clientId: string;
  readonly institutionId: string;
  readonly externalId: string;
  readonly status: ConsentStatus;
  readonly expiresAt: Date;
  readonly lastSuccessfulSyncAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: ConsentProps) {
    this.id = props.id;
    this.clientId = props.clientId;
    this.institutionId = props.institutionId;
    this.externalId = props.externalId;
    this.status = props.status;
    this.expiresAt = props.expiresAt;
    this.lastSuccessfulSyncAt = props.lastSuccessfulSyncAt ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  isActive(): boolean {
    return this.status === ConsentStatus.ACTIVE;
  }

  isExpired(referenceDate: Date = new Date()): boolean {
    return this.expiresAt.getTime() <= referenceDate.getTime();
  }

  //validacao candidato remover  
  validateCanSync(referenceDate: Date = new Date()): void {
    if (!this.isActive()) {
      throw new ConsentInactiveException(this.status);
    }
    if (this.isExpired(referenceDate)) {
      throw new ConsentExpiredException(this.expiresAt);
    }
  }
}
