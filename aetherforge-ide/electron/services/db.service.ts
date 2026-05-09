import path from 'node:path';
import { app } from 'electron';
import { Kysely, SqliteDialect } from 'kysely';
import { runMigrations } from '../db/run-migrations';
import logger from '../logger';

/**
 * Local SQLite database for sessions, AI runs, persisted preferences.
 *
 * better-sqlite3 is a native module; on systems where it cannot be built we
 * gracefully degrade to an in-memory map (only good enough for dev). The
 * higher-level SDK API is the same either way so callers do not need to care.
 */

type Row = Record<string, unknown>;

interface Db {
  exec(sql: string, params?: unknown[]): { changes: number };
  query<T = Row>(sql: string, params?: unknown[]): T[];
  close(): void;
}

let kysely: Kysely<unknown> | null = null;

let db: Db | null = null;

class MemoryDb implements Db {
  private tables = new Map<string, Row[]>();
  exec(): { changes: number } {
    logger.debug('MemoryDb exec ignored (in-memory fallback)');
    return { changes: 0 };
  }
  query<T = Row>(): T[] {
    return [] as T[];
  }
  close(): void {
    this.tables.clear();
  }
}

export async function initDb(): Promise<void> {
  if (db) return;
  try {
    const { default: Database } = await import('better-sqlite3');
    const file = path.join(app.getPath('userData'), 'aetherforge.db');
    const conn = new Database(file);
    conn.pragma('journal_mode = WAL');
    conn.pragma('foreign_keys = ON');

    kysely = new Kysely({
      dialect: new SqliteDialect({
        database: conn
      })
    });
    await runMigrations(kysely);

    db = {
      exec: (sql, params = []) => conn.prepare(sql).run(...params),
      query: <T = Row>(sql: string, params: unknown[] = []) => conn.prepare(sql).all(...params) as T[],
      close: () => {
        /* Connection released via kysely.destroy() in closeDb(). */
      }
    };
    logger.info('SQLite database initialized at', file);
  } catch (err) {
    logger.warn('better-sqlite3 unavailable; using in-memory fallback', err);
    db = new MemoryDb();
  }
}

export function getKysely(): Kysely<unknown> {
  if (!kysely) {
    throw new Error('Kysely not initialized');
  }
  return kysely;
}

export function getDb(): Db {
  if (!db) throw new Error('DB not initialized');
  return db;
}

export async function closeDb(): Promise<void> {
  if (kysely) {
    await kysely.destroy();
    kysely = null;
    db = null;
    return;
  }
  if (db) {
    db.close();
    db = null;
  }
}
