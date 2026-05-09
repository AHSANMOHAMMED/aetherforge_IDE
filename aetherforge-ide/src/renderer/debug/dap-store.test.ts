import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let storePromise: Promise<typeof import('./dap-store')> | null = null;

async function load(): Promise<typeof import('./dap-store')> {
  if (!storePromise) {
    storePromise = import('./dap-store');
  }
  return storePromise;
}

beforeEach(() => {
  const memory = new Map<string, string>();
  const storage: Storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, String(value));
    },
    removeItem: (key) => {
      memory.delete(key);
    },
    clear: () => memory.clear(),
    key: (i) => Array.from(memory.keys())[i] ?? null,
    get length() {
      return memory.size;
    }
  };
  (globalThis as unknown as { window: { localStorage: Storage } }).window = { localStorage: storage };
  (globalThis as unknown as { localStorage: Storage }).localStorage = storage;
});

afterEach(async () => {
  const { useDebugStore } = await load();
  useDebugStore.getState().reset();
  useDebugStore.setState({ breakpoints: [] });
});

describe('dap-store breakpoints', () => {
  it('toggles breakpoints idempotently', async () => {
    const { useDebugStore } = await load();
    const { toggleBreakpoint } = useDebugStore.getState();
    toggleBreakpoint('a.ts', 10);
    toggleBreakpoint('a.ts', 20);
    expect(useDebugStore.getState().breakpoints).toHaveLength(2);
    toggleBreakpoint('a.ts', 10);
    expect(useDebugStore.getState().breakpoints).toEqual([{ file: 'a.ts', line: 20, enabled: true }]);
  });

  it('replaces breakpoints for a single file via setBreakpointsForFile', async () => {
    const { useDebugStore } = await load();
    useDebugStore.getState().toggleBreakpoint('a.ts', 1);
    useDebugStore.getState().toggleBreakpoint('b.ts', 1);
    useDebugStore.getState().setBreakpointsForFile('a.ts', [10, 11]);
    const lines = useDebugStore
      .getState()
      .breakpoints.filter((bp) => bp.file === 'a.ts')
      .map((bp) => bp.line);
    expect(lines).toEqual([10, 11]);
    expect(useDebugStore.getState().breakpoints.some((bp) => bp.file === 'b.ts' && bp.line === 1)).toBe(true);
  });
});

describe('dap-store status & frames', () => {
  it('updates status and stack with auto-selecting first frame', async () => {
    const { useDebugStore } = await load();
    useDebugStore.getState().setStatus('paused', 'breakpoint hit');
    useDebugStore.getState().setStack(
      [
        { id: 1, name: 'main', line: 5 },
        { id: 2, name: 'inner', line: 12 }
      ],
      7
    );
    expect(useDebugStore.getState().selectedFrameId).toBe(1);
    expect(useDebugStore.getState().status).toBe('paused');
    expect(useDebugStore.getState().threadId).toBe(7);
  });
});
