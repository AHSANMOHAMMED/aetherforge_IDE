import { describe, expect, it } from 'vitest';
import { formatMentionContext, parseMentions, stripMentions } from './mention-parser';

describe('parseMentions', () => {
  it('returns [] for prompts with no @ tokens', () => {
    expect(parseMentions('refactor App component')).toEqual([]);
  });

  it('extracts mentions and ignores email-style strings', () => {
    const out = parseMentions('look at @src/App.tsx and @lib/utils.ts; ping ahsan@example.com');
    expect(out.map((m) => m.path)).toEqual(['src/App.tsx', 'lib/utils.ts']);
  });

  it('deduplicates repeated mentions', () => {
    const out = parseMentions('@a/b.ts @a/b.ts @c.ts');
    expect(out.map((m) => m.path)).toEqual(['a/b.ts', 'c.ts']);
  });

  it('treats parens as boundaries', () => {
    const out = parseMentions('see (@src/App.tsx) for details');
    expect(out.map((m) => m.path)).toEqual(['src/App.tsx']);
  });
});

describe('stripMentions', () => {
  it('removes mention tokens but preserves leading punctuation', () => {
    expect(stripMentions('refactor @src/App.tsx and update @lib/util.ts please')).toBe(
      'refactor and update please'
    );
  });
});

describe('formatMentionContext', () => {
  it('returns an empty string when no resolved entries', () => {
    expect(formatMentionContext([])).toBe('');
  });

  it('truncates long contents per file', () => {
    const big = 'x'.repeat(5000);
    const out = formatMentionContext([{ path: 'big.ts', content: big }], 100);
    expect(out).toContain('truncated');
    expect(out.length).toBeLessThan(big.length);
  });

  it('emits one fenced block per file', () => {
    const out = formatMentionContext([
      { path: 'a.ts', content: 'A' },
      { path: 'b.ts', content: 'B' }
    ]);
    expect(out).toContain('## a.ts');
    expect(out).toContain('## b.ts');
    expect(out.match(/```/g)?.length).toBe(4);
  });
});
