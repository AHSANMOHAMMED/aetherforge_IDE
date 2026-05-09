import { type Kysely, sql } from 'kysely';

/** Initial schema — keep in sync with `MemoryDb` bootstrap in `db.service.ts`. */
export async function migrate001Initial(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      path TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_opened INTEGER NOT NULL
    )
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      open_tabs TEXT NOT NULL,
      active_tab TEXT,
      layout TEXT,
      updated_at INTEGER NOT NULL
    )
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS ai_runs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT,
      prompt TEXT NOT NULL,
      response TEXT,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      tokens_in INTEGER,
      tokens_out INTEGER,
      cost_usd REAL,
      status TEXT NOT NULL,
      error TEXT
    )
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS ai_messages (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(run_id) REFERENCES ai_runs(id) ON DELETE CASCADE
    )
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS tool_calls (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      tool TEXT NOT NULL,
      input TEXT NOT NULL,
      output TEXT,
      status TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      FOREIGN KEY(run_id) REFERENCES ai_runs(id) ON DELETE CASCADE
    )
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS plugins (
      id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL,
      permissions TEXT,
      installed_at INTEGER NOT NULL,
      last_loaded_at INTEGER
    )
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS keybindings (
      id TEXT PRIMARY KEY,
      command TEXT NOT NULL,
      key TEXT NOT NULL,
      when_clause TEXT
    )
  `.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_ai_runs_workspace ON ai_runs(workspace_id, started_at DESC)`.execute(
    db
  );
  await sql`CREATE INDEX IF NOT EXISTS idx_ai_messages_run ON ai_messages(run_id, created_at)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_tool_calls_run ON tool_calls(run_id, started_at)`.execute(db);
}

export async function migrate001Down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS keybindings`.execute(db);
  await sql`DROP TABLE IF EXISTS plugins`.execute(db);
  await sql`DROP TABLE IF EXISTS tool_calls`.execute(db);
  await sql`DROP TABLE IF EXISTS ai_messages`.execute(db);
  await sql`DROP TABLE IF EXISTS ai_runs`.execute(db);
  await sql`DROP TABLE IF EXISTS sessions`.execute(db);
  await sql`DROP TABLE IF EXISTS workspaces`.execute(db);
}
