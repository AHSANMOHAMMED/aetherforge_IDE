import path from 'node:path';
import { existsSync } from 'node:fs';
import { app, utilityProcess } from 'electron';
import type { UtilityProcess } from 'electron';
import logger from '../logger';

/**
 * Extension host: one `utilityProcess` per plugin when using utility execution mode.
 * Bootstrap: `electron/exthost/plugin-host.cjs` (included via `package.json` build.files).
 */

const hosts = new Map<string, UtilityProcess>();

function hostScriptPath(): string {
  return path.join(app.getAppPath(), 'electron', 'exthost', 'plugin-host.cjs');
}

export function runPluginBundle(pluginId: string, bundlePath: string): { ok: boolean; error?: string } {
  if (!existsSync(bundlePath)) {
    return { ok: false, error: 'Bundle not found' };
  }
  const script = hostScriptPath();
  if (!existsSync(script)) {
    return { ok: false, error: `Extension host bootstrap missing: ${script}` };
  }

  stopExtensionHost(pluginId);

  try {
    const child = utilityProcess.fork(script, [bundlePath], {
      serviceName: `aetherforge-plugin-${pluginId}`,
      stdio: 'pipe',
      env: { ...process.env, AETHERFORGE_PLUGIN_ID: pluginId }
    });
    hosts.set(pluginId, child);
    child.stderr?.on('data', (d: Buffer) => logger.debug('[exthost]', d.toString()));
    child.stdout?.on('data', (d: Buffer) => logger.debug('[exthost]', d.toString()));
    child.on('exit', (code) => {
      hosts.delete(pluginId);
      logger.info(`[exthost] plugin ${pluginId} exited`, code);
    });
    child.on('spawn', () => logger.info(`[exthost] plugin ${pluginId} spawned`));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function stopExtensionHost(id: string): boolean {
  const p = hosts.get(id);
  if (!p) {
    return false;
  }
  p.kill();
  hosts.delete(id);
  return true;
}

export function stopAllExtensionHosts(): void {
  for (const [id, p] of hosts) {
    try {
      p.kill();
    } catch {
      // ignore
    }
    hosts.delete(id);
  }
}
