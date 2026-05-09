import * as Comlink from 'comlink';
import { usePluginRegistry } from './registry';
import { createPluginAPI, disposePlugin } from './host';
import { useModalStore } from '@/renderer/state/modal-store';

/**
 * Scans the extensions/installed/ directory via IPC, then loads+activates
 * every enabled plugin. Bundle evaluation runs inside a dedicated Web Worker
 * so a buggy/malicious plugin cannot directly touch the renderer DOM.
 */
export async function scanAndLoadPlugins(): Promise<void> {
  const registry = usePluginRegistry.getState();

  let scanResult;
  try {
    scanResult = await window.electronAPI.pluginScan();
  } catch {
    console.warn('[PluginLoader] pluginScan IPC failed — no plugins loaded.');
    return;
  }

  if (!scanResult.ok) {
    console.warn('[PluginLoader] pluginScan returned error:', scanResult.error);
    return;
  }

  for (const entry of scanResult.plugins) {
    const { manifest, installPath } = entry;

    registry.addPlugin({ manifest, installPath, enabled: true, status: 'idle' });

    if (!usePluginRegistry.getState().isEnabled(manifest.id)) {
      continue;
    }

    disposePlugin(manifest.id);

    let bundleResult;
    try {
      bundleResult = await window.electronAPI.pluginLoadBundle(manifest.id);
    } catch (err) {
      registry.setPluginStatus(manifest.id, 'error', String(err));
      continue;
    }

    if (!bundleResult.ok || !bundleResult.source) {
      registry.setPluginStatus(manifest.id, 'error', bundleResult.error ?? 'No source returned');
      continue;
    }

    if ((manifest.permissions?.length ?? 0) > 0) {
      const ok = await useModalStore.getState().requestConfirm({
        title: `Trust plugin "${manifest.id}"?`,
        description: `This plugin requests permissions: ${(manifest.permissions ?? []).join(', ')}. Only enable plugins you trust.`,
        confirmLabel: 'Enable',
        destructive: false
      });
      if (!ok) {
        registry.setPluginStatus(manifest.id, 'idle');
        continue;
      }
    }

    try {
      const WorkerCtor = (await import('./plugin-worker-runtime.ts?worker')).default;
      const worker = new WorkerCtor();
      const remote = Comlink.wrap<{ activate: (src: string, api: unknown) => Promise<void> }>(worker);
      const api = createPluginAPI(manifest);
      await remote.activate(bundleResult.source, Comlink.proxy(api));
      worker.terminate();
      registry.setPluginStatus(manifest.id, 'loaded');
      console.info(`[PluginLoader] Loaded plugin (worker): ${manifest.name} v${manifest.version}`);
    } catch (err) {
      registry.setPluginStatus(manifest.id, 'error', String(err));
      console.error(`[PluginLoader] Failed to activate plugin ${manifest.id}:`, err);
    }
  }
}

export async function executePluginCommand(id: string): Promise<boolean> {
  const cmd = usePluginRegistry.getState().commands.find((c) => c.id === id);
  if (!cmd) return false;
  try {
    await Promise.resolve(cmd.handler());
  } catch (err) {
    console.error(`[PluginLoader] Command ${id} threw:`, err);
  }
  return true;
}
