import { describe, expect, it } from 'vitest';
import { planWaves, type ToolDagNode } from './dag';
import type { AgentToolName } from './types';

const node = (i: number, deps?: number[], tool: AgentToolName = 'read_file'): ToolDagNode => ({
  tool,
  input: { path: `f${i}.ts` },
  dependsOn: deps
});

describe('planWaves', () => {
  it('returns empty for empty input', () => {
    expect(planWaves([])).toEqual([]);
  });

  it('groups consecutive safe tools into one wave when no deps declared', () => {
    expect(planWaves([node(0), node(1), node(2)])).toEqual([[0, 1, 2]]);
  });

  it('keeps guarded tools in their own waves and preserves order', () => {
    const out = planWaves([
      node(0, undefined, 'read_file'),
      node(1, undefined, 'write_file'),
      node(2, undefined, 'read_file'),
      node(3, undefined, 'read_file')
    ]);
    expect(out).toEqual([[0], [1], [2, 3]]);
  });

  it('groups independent nodes into a single wave when any node declares deps', () => {
    const out = planWaves([node(0), node(1), node(2, [0])]);
    expect(out).toEqual([[0, 1], [2]]);
  });

  it('respects multi-step chains', () => {
    const out = planWaves([node(0), node(1, [0]), node(2, [1])]);
    expect(out).toEqual([[0], [1], [2]]);
  });

  it('throws on cycles', () => {
    expect(() => planWaves([node(0, [1]), node(1, [0])])).toThrow(/cycle/i);
  });
});
