import { describe, expect, it } from 'vitest';
import { formatBriefFileDiff } from './text-diff';

describe('formatBriefFileDiff', () => {
  it('reports identical content', () => {
    expect(formatBriefFileDiff('a\nb', 'a\nb')).toContain('identical');
  });

  it('includes line counts for differing files', () => {
    const d = formatBriefFileDiff('line1\nline2', 'line1\nchanged');
    expect(d).toContain('Existing:');
    expect(d).toContain('Proposed:');
    expect(d).toContain('line1');
  });
});
