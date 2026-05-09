import { describe, expect, it } from 'vitest';
import { estimateCostUsdRough, estimateRoughTokens } from './usage';

describe('estimateRoughTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateRoughTokens('')).toBe(0);
  });

  it('approximates from length', () => {
    expect(estimateRoughTokens('abcd')).toBe(1);
    expect(estimateRoughTokens('a'.repeat(400))).toBe(100);
  });
});

describe('estimateCostUsdRough', () => {
  it('returns undefined for local ollama', () => {
    expect(estimateCostUsdRough('ollama', 1_000_000, 1_000_000)).toBeUndefined();
  });

  it('returns a positive number for cloud providers', () => {
    const v = estimateCostUsdRough('openai', 1_000_000, 1_000_000);
    expect(v).toBeDefined();
    expect(v!).toBeGreaterThan(0);
  });
});
