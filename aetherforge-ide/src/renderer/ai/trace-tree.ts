import type { AgentExecutionStep } from './types';

export type TraceTreeNode = {
  step: AgentExecutionStep;
  children: TraceTreeNode[];
};

/**
 * Build a multi-agent trace tree from a flat list of execution steps.
 * Convention: planner steps are roots, coder/reviewer steps are children of the closest preceding planner.
 */
export function buildTraceTree(steps: AgentExecutionStep[]): TraceTreeNode[] {
  const roots: TraceTreeNode[] = [];
  let currentRoot: TraceTreeNode | null = null;

  for (const step of steps) {
    if (step.role === 'planner' || !currentRoot) {
      const node: TraceTreeNode = { step, children: [] };
      roots.push(node);
      currentRoot = node;
      continue;
    }

    currentRoot.children.push({ step, children: [] });
  }

  return roots;
}

/** Compute step duration in ms when both timestamps are available. */
export function stepDurationMs(step: AgentExecutionStep): number | undefined {
  if (typeof step.completedAt !== 'number') {
    return undefined;
  }
  return Math.max(0, step.completedAt - step.startedAt);
}

export type WaveGroup = {
  wave: number;
  steps: AgentExecutionStep[];
};

/**
 * Group coder steps by their wave index. Steps without a wave fall into the catch-all `-1` bucket so
 * sequential pre-DAG runs still render. The output preserves wave ordering.
 */
export function groupStepsByWave(steps: AgentExecutionStep[]): WaveGroup[] {
  const buckets = new Map<number, AgentExecutionStep[]>();
  for (const step of steps) {
    if (step.role !== 'coder') {
      continue;
    }
    const wave = step.wave ?? -1;
    const list = buckets.get(wave);
    if (list) {
      list.push(step);
    } else {
      buckets.set(wave, [step]);
    }
  }
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([wave, list]) => ({ wave, steps: list }));
}
