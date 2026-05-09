import { describe, expect, it } from 'vitest';
import { buildTraceTree, groupStepsByWave, stepDurationMs } from './trace-tree';
import type { AgentExecutionStep } from './types';

const step = (
  id: string,
  role: AgentExecutionStep['role'],
  options: Partial<AgentExecutionStep> = {}
): AgentExecutionStep => ({
  id,
  role,
  status: 'completed',
  title: `${role} ${id}`,
  detail: '',
  startedAt: 0,
  ...options
});

describe('buildTraceTree', () => {
  it('returns [] for empty input', () => {
    expect(buildTraceTree([])).toEqual([]);
  });

  it('groups coder/reviewer under preceding planner', () => {
    const tree = buildTraceTree([
      step('p1', 'planner'),
      step('c1', 'coder'),
      step('c2', 'coder'),
      step('r1', 'reviewer'),
      step('p2', 'planner'),
      step('c3', 'coder')
    ]);
    expect(tree).toHaveLength(2);
    expect(tree[0].step.id).toBe('p1');
    expect(tree[0].children.map((c) => c.step.id)).toEqual(['c1', 'c2', 'r1']);
    expect(tree[1].step.id).toBe('p2');
    expect(tree[1].children.map((c) => c.step.id)).toEqual(['c3']);
  });
});

describe('stepDurationMs', () => {
  it('returns undefined for incomplete steps', () => {
    expect(stepDurationMs(step('s1', 'coder', { startedAt: 100 }))).toBeUndefined();
  });

  it('returns elapsed time for completed steps', () => {
    expect(stepDurationMs(step('s1', 'coder', { startedAt: 100, completedAt: 250 }))).toBe(150);
  });

  it('clamps negative durations to 0', () => {
    expect(stepDurationMs(step('s1', 'coder', { startedAt: 500, completedAt: 400 }))).toBe(0);
  });
});

describe('groupStepsByWave', () => {
  it('returns [] when there are no coder steps', () => {
    expect(groupStepsByWave([step('p1', 'planner'), step('r1', 'reviewer')])).toEqual([]);
  });

  it('buckets coder steps by wave index, preserving order', () => {
    const out = groupStepsByWave([
      step('c1', 'coder', { wave: 0 }),
      step('c2', 'coder', { wave: 0 }),
      step('c3', 'coder', { wave: 1 }),
      step('c4', 'coder')
    ]);
    expect(out.map((g) => g.wave)).toEqual([-1, 0, 1]);
    expect(out.find((g) => g.wave === 0)?.steps.map((s) => s.id)).toEqual(['c1', 'c2']);
  });
});
