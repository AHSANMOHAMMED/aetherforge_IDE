import { type Kysely, sql } from 'kysely';

/**
 * Extend `ai_runs` with JSON-shaped columns so the renderer can persist a full agent run (including
 * the trace step list and usage estimate) atomically through `db:execute` / `db:query`. Older rows
 * default to `NULL`, preserving compatibility with the V1 ai_runs schema.
 */
export async function migrate002AiRunsJson(db: Kysely<unknown>): Promise<void> {
  const columns: Array<{ name: string }> = await sql<{
    name: string;
  }>`PRAGMA table_info(ai_runs)`
    .execute(db)
    .then((res) => (res.rows as Array<{ name: string }>) ?? []);
  const have = new Set(columns.map((c) => c.name));

  if (!have.has('steps_json')) {
    await sql`ALTER TABLE ai_runs ADD COLUMN steps_json TEXT`.execute(db);
  }
  if (!have.has('usage_json')) {
    await sql`ALTER TABLE ai_runs ADD COLUMN usage_json TEXT`.execute(db);
  }
}

export async function migrate002Down(db: Kysely<unknown>): Promise<void> {
  // SQLite cannot easily DROP COLUMN before 3.35; we leave the columns in place on rollback.
  void db;
}
