import { utilityProcess } from 'electron';
import type { UtilityProcess } from 'electron';
import logger from '../logger';

/**
 * Extension host (V2): one `utilityProcess` per logical host for Comlink RPC.
 * Full contribution registry is renderer-side; this module only tracks OS processes.
 */

const hosts = new Map<string, UtilityProcess>();

export function startExtensionHost(id: string, entryScriptPath: string): { ok: boolean; error?: string } {
  try {
    const child = utilityProcess.fork(entryScriptPath, [], {
      serviceName: `aetherforge-exthost-${id}`,
      stdio: 'pipe',
      env: { ...process.env, AETHERFORGE_EXTHOST_ID: id }
    });
    hosts.set(id, child);
    child.on('exit', (code) => {
      hosts.delete(id);
      logger.info(`Extension host ${id} exited`, code);
    });
    child.on('spawn', () => logger.info(`Extension host ${id} spawned`));
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
