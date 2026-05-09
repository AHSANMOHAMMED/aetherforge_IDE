import type { AgentRun } from './types';

/**
 * Persist agent runs through the renderer ↔ main `db:*` IPC bridge. The schema for `ai_runs` is
 * defined in `electron/db/migrations/001-initial.ts` + `002-ai-runs-json.ts`.
 *
 * Storage shape per row:
 *   id           TEXT PK     - run.id
 *   prompt       TEXT        - run.prompt
 *   response     TEXT NULL   - run.response
 *   provider     TEXT        - run.provider
 *   model        TEXT        - placeholder until settings model is plumbed in
 *   started_at   INTEGER     - run.createdAt
 *   completed_at INTEGER NULL- run.completedAt
 *   tokens_in    INTEGER NULL- run.usageEstimate input total
 *   tokens_out   INTEGER NULL- run.usageEstimate output total
 *   cost_usd     REAL    NULL- run.usageEstimate.costUsdRough
 *   status       TEXT        - run.status
 *   error        TEXT NULL   - run.error
 *   steps_json   TEXT NULL   - JSON.stringify(run.steps)
 *   usage_json   TEXT NULL   - JSON.stringify(run.usageEstimate)
 */

const MAX_PERSISTED_RUNS = 60;

function isElectronAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  const api = window.electronAPI as { dbExecute?: unknown; dbQuery?: unknown } | undefined;
  return Boolean(api?.dbExecute) && Boolean(api?.dbQuery);
}

type PersistedRow = {
  id: string;
  prompt: string;
  response: string | null;
  provider: string;
  status: string;
  error: string | null;
  started_at: number;
  completed_at: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_usd: number | null;
  steps_json: string | null;
  usage_json: string | null;
};

function rowToRun(row: PersistedRow): AgentRun | null {
  try {
    const steps = row.steps_json ? (JSON.parse(row.steps_json) as AgentRun['steps']) : [];
    const usageEstimate = row.usage_json
      ? (JSON.parse(row.usage_json) as AgentRun['usageEstimate'])
      : undefined;
    if (
      row.status !== 'running' &&
      row.status !== 'completed' &&
      row.status !== 'canceled' &&
      row.status !== 'failed'
    ) {
      return null;
    }
    return {
      id: row.id,
      prompt: row.prompt,
      provider: row.provider as AgentRun['provider'],
      status: row.status,
      createdAt: row.started_at,
      completedAt: row.completed_at ?? undefined,
      response: row.response ?? undefined,
      error: row.error ?? undefined,
      steps,
      usageEstimate
    };
  } catch {
    return null;
  }
}

export async function saveRun(run: AgentRun, modelHint?: string): Promise<void> {
  if (!isElectronAvailable()) return;
  const tokensIn = run.usageEstimate
    ? run.usageEstimate.plannerInput + run.usageEstimate.reviewerInput
    : null;
  const tokensOut = run.usageEstimate
    ? run.usageEstimate.plannerOutput + run.usageEstimate.reviewerOutput
    : null;
  const costUsd = run.usageEstimate?.costUsdRough ?? null;

  const sql = `INSERT INTO ai_runs(
      id, prompt, response, provider, model, started_at, completed_at,
      tokens_in, tokens_out, cost_usd, status, error, steps_json, usage_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      response = excluded.response,
      completed_at = excluded.completed_at,
      tokens_in = excluded.tokens_in,
      tokens_out = excluded.tokens_out,
      cost_usd = excluded.cost_usd,
      status = excluded.status,
      error = excluded.error,
      steps_json = excluded.steps_json,
      usage_json = excluded.usage_json`;

  await window.electronAPI.dbExecute({
    sql,
    params: [
      run.id,
      run.prompt,
      run.response ?? null,
      run.provider,
      modelHint ?? '',
      run.createdAt,
      run.completedAt ?? null,
      tokensIn,
      tokensOut,
      costUsd,
      run.status,
      run.error ?? null,
      JSON.stringify(run.steps),
      run.usageEstimate ? JSON.stringify(run.usageEstimate) : null
    ]
  });
}

export async function loadRuns(limit = MAX_PERSISTED_RUNS): Promise<AgentRun[]> {
  if (!isElectronAvailable()) return [];
  try {
    const result = await window.electronAPI.dbQuery<PersistedRow>({
      sql: `SELECT id, prompt, response, provider, status, error, started_at, completed_at,
                tokens_in, tokens_out, cost_usd, steps_json, usage_json
            FROM ai_runs
            ORDER BY started_at DESC
            LIMIT ?`,
      params: [limit]
    });
    if (!result.ok) return [];
    return result.rows.map(rowToRun).filter((run): run is AgentRun => run !== null);
  } catch {
    return [];
  }
}

export async function clearRuns(): Promise<void> {
  if (!isElectronAvailable()) return;
  try {
    await window.electronAPI.dbExecute({ sql: `DELETE FROM ai_runs`, params: [] });
  } catch {
    // ignore
  }
}
