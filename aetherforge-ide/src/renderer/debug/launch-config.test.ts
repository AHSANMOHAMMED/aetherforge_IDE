import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ReadFileResult = { content: string; encoding: 'utf-8' | 'binary'; size: number; mtime: number };

let readFile: ReturnType<typeof vi.fn>;

beforeEach(() => {
  readFile = vi.fn();
  (globalThis as unknown as { window: { electronAPI: { readFile: typeof readFile } } }).window = {
    electronAPI: { readFile }
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe('loadLaunchConfigurations', () => {
  it('returns [] when readFile fails or yields empty content', async () => {
    const { loadLaunchConfigurations } = await import('./launch-config');
    readFile.mockResolvedValue({
      content: '',
      encoding: 'utf-8',
      size: 0,
      mtime: 0
    } satisfies ReadFileResult);
    expect(await loadLaunchConfigurations('/ws')).toEqual([]);

    readFile.mockRejectedValueOnce(new Error('boom'));
    expect(await loadLaunchConfigurations('/ws')).toEqual([]);
  });

  it('parses and filters valid configurations', async () => {
    const { loadLaunchConfigurations } = await import('./launch-config');
    readFile.mockResolvedValue({
      content: JSON.stringify({
        version: '0.2.0',
        configurations: [
          { name: 'Run Node', type: 'node', request: 'launch', program: 'index.js' },
          { name: 'Bad', type: 'node' },
          { name: 'Attach Chrome', type: 'chrome', request: 'attach', port: 9222 }
        ]
      }),
      encoding: 'utf-8',
      size: 100,
      mtime: 0
    } satisfies ReadFileResult);

    const list = await loadLaunchConfigurations('/ws');
    expect(list.map((c) => c.name)).toEqual(['Run Node', 'Attach Chrome']);
  });
});

describe('defaultLaunchConfigFile', () => {
  it('returns a usable Node launch template', async () => {
    const { defaultLaunchConfigFile } = await import('./launch-config');
    const file = defaultLaunchConfigFile();
    expect(file.version).toBe('0.2.0');
    expect(file.configurations[0]?.type).toBe('node');
    expect(file.configurations[0]?.request).toBe('launch');
  });
});
