import { PrismaService } from '../../src/infrastructure/database/prisma.service';

export function createMockPrismaService(): PrismaService {
  const consents = new Map<string, any>();
  const accounts = new Map<string, any>();
  const consentAccounts = new Set<string>();
  const transactions = new Map<string, any>();

  const mock: any = {
    consent: {
      findUnique: async ({ where }: any) => {
        return consents.get(where.id) || null;
      },
      update: async ({ where, data }: any) => {
        const existing = consents.get(where.id);
        if (existing) {
          const updated = { ...existing, ...data, updatedAt: new Date() };
          consents.set(where.id, updated);
          return updated;
        }
        return null;
      },
      create: async ({ data }: any) => {
        const record = { id: data.id || `c-${Date.now()}`, ...data };
        consents.set(record.id, record);
        return record;
      },
    },
    account: {
      upsert: async ({ where, create, update }: any) => {
        const key = `${where.uk_accounts_institution_external.institutionId}:${where.uk_accounts_institution_external.externalId}`;
        const existing = accounts.get(key);
        if (existing) {
          const updated = { ...existing, ...update };
          accounts.set(key, updated);
          return updated;
        }
        const record = {
          id: create.id || `acc-uuid-${Math.random().toString(36).substring(2, 9)}`,
          ...create,
          createdAt: new Date(),
        };
        accounts.set(key, record);
        return record;
      },
    },
    consentAccount: {
      upsert: async ({ where, create }: any) => {
        const key = `${where.consentId_accountId.consentId}:${where.consentId_accountId.accountId}`;
        consentAccounts.add(key);
        return { ...create, createdAt: new Date() };
      },
    },
    transaction: {
      createMany: async ({ data, skipDuplicates }: any) => {
        let count = 0;
        for (const item of data) {
          const ukKey = `${item.accountId}:${item.externalId}`;
          if (transactions.has(ukKey)) {
            if (!skipDuplicates) {
              throw new Error(`Unique constraint failed on the fields: (account_id, external_id)`);
            }
          } else {
            const record = {
              id: item.id || `tx-uuid-${Math.random().toString(36).substring(2, 9)}`,
              ...item,
              createdAt: new Date(),
            };
            transactions.set(ukKey, record);
            count++;
          }
        }
        return { count };
      },
      count: async ({ where }: any) => {
        let total = 0;
        for (const tx of transactions.values()) {
          if (!where?.accountId || tx.accountId === where.accountId) {
            total++;
          }
        }
        return total;
      },
      findMany: async ({ take, skip, cursor, where, orderBy }: any) => {
        let list: any[] = [];
        for (const tx of transactions.values()) {
          let matches = true;
          if (where?.account?.clientId) {
            const acc = Array.from(accounts.values()).find((a) => a.id === tx.accountId);
            if (!acc || acc.clientId !== where.account.clientId) {
              matches = false;
            }
          }
          if (matches) {
            list.push(tx);
          }
        }

        // Ordenação composta por transactionDate DESC, id DESC
        list.sort((a, b) => {
          const dateDiff = new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime();
          if (dateDiff !== 0) return dateDiff;
          return b.id.localeCompare(a.id);
        });

        if (cursor?.id) {
          const cursorIndex = list.findIndex((i) => i.id === cursor.id);
          if (cursorIndex !== -1) {
            list = list.slice(cursorIndex + (skip || 0));
          }
        }

        if (take) {
          list = list.slice(0, take);
        }

        return list;
      },
    },
    $disconnect: async () => {},
    $connect: async () => {},
    _clear: () => {
      consents.clear();
      accounts.clear();
      consentAccounts.clear();
      transactions.clear();
    },
  };

  return mock as PrismaService;
}
