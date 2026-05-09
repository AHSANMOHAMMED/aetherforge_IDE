import { type Kysely, sql } from 'kysely';

/** Optional local table for future persisted RAG vectors (in-memory indexer is primary for V1). */
export async function migrate003RagEmbeddings(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS rag_embeddings (
      workspace_path TEXT NOT NULL,
      file_path TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      embedding_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (workspace_path, file_path)
    )
  `.execute(db);
}

export async function migrate003Down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS rag_embeddings`.execute(db);
}
