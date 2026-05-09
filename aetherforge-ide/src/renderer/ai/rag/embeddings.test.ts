import { describe, expect, it } from 'vitest';
import { cosineSimilarity } from './embeddings';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = new Float32Array([1, 0, 0]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity(new Float32Array([1, 0]), new Float32Array([0, 1]))).toBeCloseTo(0, 5);
  });

  it('returns 0 when shapes differ or one vector is zero', () => {
    expect(cosineSimilarity(new Float32Array([1, 2]), new Float32Array([0, 0]))).toBe(0);
    expect(cosineSimilarity(new Float32Array([1]), new Float32Array([1, 0]))).toBe(0);
  });
});
