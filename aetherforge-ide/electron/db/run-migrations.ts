import type { Kysely, Migration, MigrationProvider } from 'kysely';
import { Migrator } from 'kysely';
import logger from '../logger';
import { migrate001Down, migrate001Initial } from './migrations/001-initial';
import { migrate002AiRunsJson, migrate002Down } from './migrations/002-ai-runs-json';

const migrations: Record<string, Migration> = {
  '001_initial': {
    up: async (db) => migrate001Initial(db),
    down: async (db) => migrate001Down(db)
  },
  '002_ai_runs_json': {
    up: async (db) => migrate002AiRunsJson(db),
    down: async (db) => migrate002Down(db)
  }
};

class StaticMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return migrations;
  }
}

export async function runMigrations(db: Kysely<unknown>): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: new StaticMigrationProvider()
  });
  const { error, results } = await migrator.migrateToLatest();
  if (results) {
    for (const r of results) {
      if (r.status === 'Success') {
        logger.info(`[db] migration ${r.migrationName}: ${r.direction}`);
      }
    }
  }
  if (error) {
    throw error;
  }
}
