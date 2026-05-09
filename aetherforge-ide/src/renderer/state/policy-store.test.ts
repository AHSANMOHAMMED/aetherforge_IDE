import { afterEach, beforeEach, describe, expect, it } from 'vitest';

type AirGapWindow = { __AETHERFORGE_AIRGAP__?: boolean };

let policyStorePromise: Promise<typeof import('./policy-store')> | null = null;

async function loadStore(): Promise<typeof import('./policy-store')> {
  if (!policyStorePromise) {
    policyStorePromise = import('./policy-store');
  }
  return policyStorePromise;
}

beforeEach(() => {
  const memoryStorage = (() => {
    const store = new Map<string, string>();
    return {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size;
      }
    } satisfies Storage;
  })();

  if (typeof globalThis.window === 'undefined') {
    (globalThis as unknown as { window: AirGapWindow & { localStorage: Storage } }).window = {
      localStorage: memoryStorage
    };
  } else {
    (globalThis as unknown as { window: AirGapWindow & { localStorage?: Storage } }).window.localStorage =
      memoryStorage;
  }
  (globalThis as unknown as { localStorage: Storage }).localStorage = memoryStorage;
  (globalThis as unknown as { window: AirGapWindow }).window.__AETHERFORGE_AIRGAP__ = false;
});

afterEach(async () => {
  const { usePolicyStore } = await loadStore();
  usePolicyStore.setState({
    policy: { airGap: false, providerAllow: [], modelAllow: [], pluginAllow: [] }
  });
});

describe('policy-store', () => {
  it('mirrors air-gap to window.__AETHERFORGE_AIRGAP__', async () => {
    const { usePolicyStore } = await loadStore();
    usePolicyStore.getState().setAirGap(true);
    expect(usePolicyStore.getState().policy.airGap).toBe(true);
    expect((globalThis as unknown as { window: AirGapWindow }).window.__AETHERFORGE_AIRGAP__).toBe(true);
  });

  it('updates allowlists independently', async () => {
    const { usePolicyStore } = await loadStore();
    usePolicyStore.getState().setProviderAllow(['openai', 'claude']);
    usePolicyStore.getState().setModelAllow(['gpt-4.1-mini']);
    usePolicyStore.getState().setPluginAllow(['acme.helper']);
    expect(usePolicyStore.getState().policy.providerAllow).toEqual(['openai', 'claude']);
    expect(usePolicyStore.getState().policy.modelAllow).toEqual(['gpt-4.1-mini']);
    expect(usePolicyStore.getState().policy.pluginAllow).toEqual(['acme.helper']);
  });

  it('applyRemote overwrites and mirrors air-gap', async () => {
    const { usePolicyStore } = await loadStore();
    usePolicyStore.getState().applyRemote({
      airGap: true,
      providerAllow: ['ollama'],
      modelAllow: [],
      pluginAllow: ['acme.local']
    });
    expect(usePolicyStore.getState().policy.providerAllow).toEqual(['ollama']);
    expect(usePolicyStore.getState().policy.airGap).toBe(true);
    expect((globalThis as unknown as { window: AirGapWindow }).window.__AETHERFORGE_AIRGAP__).toBe(true);
  });
});
