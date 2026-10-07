-- Tabela de Consentimentos
CREATE TABLE IF NOT EXISTS consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id VARCHAR(100) NOT NULL,
    institution_id VARCHAR(100) NOT NULL,
    external_id VARCHAR(150) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    expires_at TIMESTAMPTZ NOT NULL,
    last_successful_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_consents_institution_external UNIQUE (institution_id, external_id)
);

-- Tabela de Contas
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id VARCHAR(100) NOT NULL,
    institution_id VARCHAR(100) NOT NULL,
    external_id VARCHAR(150) NOT NULL,
    number VARCHAR(50),
    type VARCHAR(30) DEFAULT 'CHECKING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_accounts_institution_external UNIQUE (institution_id, external_id)
);

-- Tabela Associativa entre Consentimentos e Contas (N:N)
CREATE TABLE IF NOT EXISTS consent_accounts (
    consent_id UUID NOT NULL REFERENCES consents(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (consent_id, account_id)
);

-- Tabela de Transações / Lançamentos
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    external_id VARCHAR(150) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
    transaction_date TIMESTAMPTZ NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'POSTED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_transactions_account_external UNIQUE (account_id, external_id)
);

-- Índices B-tree para otimização de consultas e paginação por cursor
CREATE INDEX IF NOT EXISTS idx_transactions_account_date_id 
    ON transactions (account_id, transaction_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_accounts_client_id 
    ON accounts (client_id);

CREATE INDEX IF NOT EXISTS idx_consents_client_status 
    ON consents (client_id, status);
