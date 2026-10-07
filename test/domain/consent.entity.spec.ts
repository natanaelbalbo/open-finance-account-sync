import { ConsentEntity } from '../../src/domain/entities/consent.entity';
import { ConsentStatus } from '../../src/domain/types/financial-types';
import {
  ConsentExpiredException,
  ConsentInactiveException,
} from '../../src/domain/exceptions/domain.exceptions';

describe('ConsentEntity', () => {
  const baseProps = {
    id: 'c1-1111',
    clientId: 'cli-99',
    institutionId: 'bank-a',
    externalId: 'ext-c-1',
    status: ConsentStatus.ACTIVE,
    expiresAt: new Date(Date.now() + 86400000),
  };

  it('deve validar com sucesso quando o consentimento estiver ativo e dentro do prazo', () => {
    const consent = new ConsentEntity(baseProps);
    expect(() => consent.validateCanSync()).not.toThrow();
    expect(consent.isActive()).toBe(true);
    expect(consent.isExpired()).toBe(false);
  });

  it('deve lançar exceção quando o consentimento não estiver ativo', () => {
    const consent = new ConsentEntity({
      ...baseProps,
      status: ConsentStatus.REVOKED,
    });
    expect(() => consent.validateCanSync()).toThrow(ConsentInactiveException);
    expect(consent.isActive()).toBe(false);
  });

  it('deve lancar excecão quando o consentimento estiver com data de validade expirada', () => {
    const consent = new ConsentEntity({
      ...baseProps,
      expiresAt: new Date(Date.now() - 3600000),
    });
    expect(() => consent.validateCanSync()).toThrow(ConsentExpiredException);
    expect(consent.isExpired()).toBe(true);
  });
});
