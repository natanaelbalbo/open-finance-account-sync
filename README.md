# Sincronização de Contas e Extrato (Open Finance)

Microsserviço em Node.js com Nest.js, Prisma e PostgreSQL para sincronizar lançamentos de contas parceiras e disponibilizar extrato consolidado.

O foco da implementação é a resiliência: suportar reprocessamento da mesma mensagem da fila, tratar rate limit (HTTP 429) e garantir que nenhum lançamento seja duplicado no banco mesmo sob concorrência simultânea.

---

## Como rodar o projeto

### 1. Pré-requisitos
- Node.js 20+ (ou 22+)
- Docker e Docker Compose (para subir o Postgres local)

### 2. Configurar o ambiente
Copie o arquivo de variáveis de ambiente:
```bash
cp .env.example .env
```

Suba o banco de dados com Docker:
```bash
docker compose up -d
```

### 3. Instalar dependências e gerar o Prisma Client
```bash
npm install
npx prisma generate
```

### 4. Rodar a aplicação
```bash
# Modo desenvolvimento
npm run start:dev

# Build de produção
npm run build
npm run start:prod
```

---

## Testes Automatizados

Para rodar todos os testes unitários e de integração:
```bash
npm test
```

Cenários cobertos na suíte:
- Idempotência: reprocessar a mesma mensagem da fila não duplica lançamentos.
- Concorrência: múltiplos workers gravando os mesmos dados simultaneamente (`Promise.all`).
- Retomada após falha parcial: registros salvos da página 1 não são perdidos nem duplicados quando a tentativa seguinte completa as demais páginas.
- Rate Limit (HTTP 429): cálculo de delay com `Retry-After` (segundos e data) e fallback com backoff exponencial + jitter.
- Extrato por cursor: paginação decrescente e isolamento correto entre clientes.

---

## Decisões Técnicas e Arquitetura

### Estrutura das Pastas
Estruturei a aplicação com uma separação inspirada em Clean Architecture:
- `src/domain`: entidades (`Consent`, `Account`, `Transaction`), tipos e exceções de negócio.
- `src/application`: serviço de sincronização (`SyncConsentService`) que orquestra o fluxo de consumo, chamadas HTTP e persistência.
- `src/infrastructure`:
  - `database`: PrismaService e repositórios de persistência e consulta.
  - `partner-api`: mock da API parceira e cálculo de retries.
  - `queue`: consumidor e fila simulada com controle de delay e DLQ.
  - `logging`: logger estruturado em JSON com identificadores de correlação (`sync_id`, `message_id`).
- `src/presentation`: controller de extrato com validação de entrada.

### 1. Proteção contra lançamentos duplicados
- Não dependo de fazer `SELECT` antes de inserir, pois em ambiente concorrente dois workers passariam na checagem no mesmo instante.
- Criei uma restrição única composta no banco em `(account_id, external_id)`.
- No Prisma, usei `prisma.transaction.createMany({ data, skipDuplicates: true })`, que executa o `ON CONFLICT (account_id, external_id) DO NOTHING` nativo do PostgreSQL.
- Se a mesma transação for recebida novamente (por reentrega de fila ou workers simultâneos), o banco ignora a inserção sem estourar erro e sem duplicar dados.
- Para as contas, defini `unique(institution_id, external_id)`. Assim, uma renovação de consentimento continua vinculada à conta já existente em vez de criar outra.

### 2. Tratamento de falhas parciais
- **Nenhuma transação de banco fica aberta durante chamadas HTTP.** A cada página retornada da API parceira, gravo os lançamentos imediatamente em lote.
- Se a sincronização falhar na página 2 de 3 (ex: timeout ou erro 500 do parceiro), os lançamentos já gravados da página 1 permanecem salvos no banco.
- O campo `last_successful_sync_at` só é atualizado após a conclusão de todas as páginas.
- Na tentativa seguinte da fila, o processo recomeça: a página 1 é ignorada pelo `skipDuplicates` e as páginas restantes são gravadas com sucesso.

### 3. Tratamento de HTTP 429 (Rate Limit)
- Ao receber 429 da API parceira, interrompo a tentativa imediatamente para não sobrecarregar a instituição.
- Se a resposta trouxer o cabeçalho `Retry-After`, trato tanto o valor numérico em segundos quanto datas no formato HTTP-Date para calcular os milissegundos de espera.
- Se não vier cabeçalho, aplico espera progressiva (backoff exponencial) com jitter aleatório para evitar que várias requisições voltem a bater na API no mesmo segundo.
- A mensagem **não** recebe confirmação (ACK); ela é devolvida para a fila com tempo de espera (`nackWithDelay`).
- Ao atingir o limite configurado de tentativas (`QUEUE_MAX_ATTEMPTS`), a mensagem é enviada para a Dead Letter Queue (DLQ).

### 4. Valores monetários
- Não usei o tipo `number` do JavaScript em cálculos financeiros por conta de imprecisão de ponto flutuante binário (`0.1 + 0.2`).
- No banco utilizei `NUMERIC(15, 2)` (mapeado como `Decimal` no Prisma) e no domínio trato como string decimal formatada com 2 casas.

### 5. Consulta de extrato com paginação por cursor
- Implementei o endpoint de listagem com paginação por cursor (`keyset pagination`) ordenado por `transaction_date DESC, id DESC`.
- Evitei o uso de `OFFSET`, que degrada a performance conforme o volume de registros cresce e pode causar duplicidade ou salto de itens caso novas transações entrem durante a paginação.
- O filtro é feito pelo cliente através do relacionamento da conta (`where: { account: { clientId } }`). Isso evita duplicar linhas caso uma mesma conta possua mais de um consentimento histórico.
- Mapeei índices no schema para apoiar essa consulta:
  - `(account_id, transaction_date DESC, id DESC)` na tabela de transações.
  - `(client_id)` na tabela de contas.

---

## Variáveis de Ambiente

As variáveis necessárias estão no `.env.example`:
- `DATABASE_URL`: string de conexão com o PostgreSQL.
- `PORT`: porta do servidor HTTP (padrão 3000).
- `QUEUE_MAX_ATTEMPTS`: número máximo de tentativas antes de enviar para a DLQ.
- `QUEUE_BASE_BACKOFF_MS` e `QUEUE_MAX_BACKOFF_MS`: tempos base e teto para o cálculo de backoff.
