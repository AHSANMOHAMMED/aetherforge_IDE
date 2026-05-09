import type { AgentToolCall, AgentToolName } from './types';

export type ToolDagNode = AgentToolCall & {
  /** Optional set of node *indices* (relative to the planner's actions array) this node depends on. */
  dependsOn?: number[];
};

/**
 * Tools whose execution has no observable side effects on the workspace, terminal, or visual graphs
 * and is therefore safe to run in parallel within a wave.
 */
export const SAFE_PARALLEL_TOOLS: ReadonlySet<AgentToolName> = new Set<AgentToolName>(['read_file']);

/**
 * Group planner actions into execution waves. Within a wave, tools may run in parallel.
 *
 * Strategy:
 *   1. If any node declares `dependsOn`, we do a topological sort honouring those edges, allowing
 *      every independent node in the same level to run in parallel.
 *   2. Otherwise we greedily merge consecutive *safe* tools (e.g. `read_file`) into a single wave;
 *      any guarded tool (write/run/etc.) gets its own wave to preserve the planner's intended order.
 */
export function planWaves(actions: ToolDagNode[]): number[][] {
  if (actions.length === 0) {
    return [];
  }

  const explicit = actions.some((a) => Array.isArray(a.dependsOn) && a.dependsOn.length > 0);
  if (!explicit) {
    const waves: number[][] = [];
    let safeWave: number[] = [];
    actions.forEach((action, idx) => {
      if (SAFE_PARALLEL_TOOLS.has(action.tool)) {
        safeWave.push(idx);
        return;
      }
      if (safeWave.length > 0) {
        waves.push(safeWave);
        safeWave = [];
      }
      waves.push([idx]);
    });
    if (safeWave.length > 0) {
      waves.push(safeWave);
    }
    return waves;
  }

  const waves: number[][] = [];
  const completed = new Set<number>();
  const remaining = new Set(actions.map((_, i) => i));
  const guard = actions.length * 2;
  let iter = 0;

  while (remaining.size > 0 && iter++ < guard) {
    const wave: number[] = [];
    for (const idx of remaining) {
      const deps = actions[idx].dependsOn ?? [];
      if (deps.every((d) => completed.has(d))) {
        wave.push(idx);
      }
    }

    if (wave.length === 0) {
      throw new Error('Cycle detected in tool DAG');
    }

    for (const idx of wave) {
      remaining.delete(idx);
      completed.add(idx);
    }
    waves.push(wave);
  }

  return waves;
}
