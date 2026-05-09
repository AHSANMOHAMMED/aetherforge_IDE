import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pickLwwWinner, pushManifest } from './sync-client';

describe('pickLwwWinner', () => {
  it('returns local when local is newer', () => {
    expect(pickLwwWinner({ path: 'a', localUpdatedAt: 2, remoteUpdatedAt: 1 })).toBe('local');
  });

  it('returns remote when remote is newer', () => {
    expect(pickLwwWinner({ path: 'a', localUpdatedAt: 1, remoteUpdatedAt: 2 })).toBe('remote');
  });

  it('returns tie when timestamps match', () => {
    expect(pickLwwWinner({ path: 'a', localUpdatedAt: 5, remoteUpdatedAt: 5 })).toBe('tie');
  });
});

describe('pushManifest', () => {
  const originalFetch = globalThis.fetch;
  const originalAirgap = process.env.AETHERFORGE_AIRGAP;

  beforeEach(() => {
    delete process.env.AETHERFORGE_AIRGAP;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.AETHERFORGE_AIRGAP = originalAirgap;
    vi.restoreAllMocks();
  });

  it('returns manifest response on success', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, acceptedFiles: 1, uploadUrls: [] }), { status: 200 })
    ) as unknown as typeof fetch;
    const out = await pushManifest('https://api.example.com', 'ws-1', [
      { path: 'README.md', sha256: 'a', bytes: 100 }
    ]);
    expect(out.ok).toBe(true);
    expect(out.acceptedFiles).toBe(1);
  });

  it('marks not-ok on non-200', async () => {
    globalThis.fetch = vi.fn(async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
    const out = await pushManifest('https://api.example.com', 'ws-1', []);
    expect(out.ok).toBe(false);
    expect(out.note).toContain('500');
  });

  it('short-circuits in air-gap mode', async () => {
    process.env.AETHERFORGE_AIRGAP = '1';
    const spy = vi.fn();
    globalThis.fetch = spy as unknown as typeof fetch;
    const out = await pushManifest('https://api.example.com', 'ws-1', []);
    expect(out.ok).toBe(false);
    expect(out.note).toContain('Air-gap');
    expect(spy).not.toHaveBeenCalled();
  });
});
