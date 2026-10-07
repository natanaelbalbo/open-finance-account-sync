export class DomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ConsentNotFoundException extends DomainException {
  constructor(consentId: string) {
    super(`consentimento não encontrado para o identificador informado: ${consentId}`);
  }
}

export class ConsentInactiveException extends DomainException {
  constructor(status: string) {
    super(`consentimento não está ativo. Status atual: ${status}`);
  }
}

export class ConsentExpiredException extends DomainException {
  constructor(expiresAt: Date) {
    super(`consentimento expirado em: ${expiresAt.toISOString()}`);
  }
}

export class InvalidTransactionDataException extends DomainException {
  constructor(details: string) {
    super(`dados do lançamento inválidos: ${details}`);
  }
}
