export interface AccountProps {
  id?: string;
  clientId: string;
  institutionId: string;
  externalId: string;
  number?: string;
  type?: string;
  createdAt?: Date;
}

export class AccountEntity {
  readonly id?: string;
  readonly clientId: string;
  readonly institutionId: string;
  readonly externalId: string;
  readonly number?: string;
  readonly type: string;
  readonly createdAt: Date;

  constructor(props: AccountProps) {
    this.id = props.id;
    this.clientId = props.clientId;
    this.institutionId = props.institutionId;
    this.externalId = props.externalId;
    this.number = props.number;
    this.type = props.type ?? 'CHECKING';
    this.createdAt = props.createdAt ?? new Date();
  }
}
