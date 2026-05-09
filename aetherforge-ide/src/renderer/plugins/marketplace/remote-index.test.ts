import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchRemoteIndex, mergeCatalogs } from './remote-index';
import type { CatalogEntry } from './catalog';

const local: CatalogEntry = {
  id: 'a',
  name: 'A (local)',
  description: '',
  author: '',
  version: '1.0.0',
  tags: [],
  downloads: 0,
  bundled: true,
  contributes: {}
};
const remote: CatalogEntry = {
  ...local,
  id: 'a',
  name: 'A (remote)',
  bundled: false
};
const remoteOnly: CatalogEntry = { ...local, id: 'b', name: 'B (remote-only)' };

describe('mergeCatalogs', () => {
  it('keeps local entry on id collision', () => {
    const merged = mergeCatalogs([local], [remote, remoteOnly]);
    expect(merged.map((e) => e.id)).toEqual(['a', 'b']);
    expect(merged[0].name).toBe('A (local)');
  });

  it('returns local-only when remote is empty', () => {
    const merged = mergeCatalogs([local], []);
    expect(merged).toEqual([local]);
  });
});

describe('fetchRemoteIndex', () => {
  const originalFetch = globalThis.fetch;
  const originalAirgap = process.env.AETHERFORGE_AIRGAP;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.AETHERFORGE_AIRGAP = originalAirgap;
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    delete process.env.AETHERFORGE_AIRGAP;
  });

  it('returns mapped entries on success', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            schema: 1,
            updatedAt: '2026-05-09T00:00:00Z',
            extensions: [
              { id: 'r1', name: 'Remote One', publisher: 'pub', version: '1.0.0', description: 'desc' }
            ]
          }),
          { status: 200 }
        )
    ) as unknown as typeof fetch;
    const out = await fetchRemoteIndex('https://example.invalid/index.json');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'r1', name: 'Remote One', author: 'pub', bundled: false });
  });

  it('returns [] on non-OK response', async () => {
    globalThis.fetch = vi.fn(async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
    expect(await fetchRemoteIndex('https://example.invalid/index.json')).toEqual([]);
  });

  it('returns [] when fetch throws', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('boom');
    }) as unknown as typeof fetch;
    expect(await fetchRemoteIndex('https://example.invalid/index.json')).toEqual([]);
  });

  it('returns [] in air-gap mode without calling fetch', async () => {
    process.env.AETHERFORGE_AIRGAP = '1';
    const spy = vi.fn();
    globalThis.fetch = spy as unknown as typeof fetch;
    expect(await fetchRemoteIndex('https://example.invalid/index.json')).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
});
