import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

export class TestDatabaseHelper {
  private pglite: PGlite;
  private prisma: PrismaService;

  private constructor(pglite: PGlite, prisma: PrismaService) {
    this.pglite = pglite;
    this.prisma = prisma;
  }

  static async create(): Promise<TestDatabaseHelper> {
    const pglite = new PGlite();
    const migrationPath = path.resolve(
      __dirname,
      '../../src/infrastructure/database/migrations/001_create_schema.sql',
    );
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await pglite.exec(sql);

    const fakePool: any = {
      connect: async () => ({
        query: (text: string, params?: any[]) => pglite.query(text, params),
        release: () => {},
      }),
      query: (text: string, params?: any[]) => pglite.query(text, params),
      on: () => {},
      end: async () => {},
    };

    const prisma = new PrismaService(fakePool);
    return new TestDatabaseHelper(pglite, prisma);
  }

  getPrisma(): PrismaService {
    return this.prisma;
  }

  getPGlite(): PGlite {
    return this.pglite;
  }

  async cleanAllTables(): Promise<void> {
    await this.pglite.exec(`
      DELETE FROM transactions;
      DELETE FROM consent_accounts;
      DELETE FROM accounts;
      DELETE FROM consents;
    `);
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
    await this.pglite.close();
  }
}
