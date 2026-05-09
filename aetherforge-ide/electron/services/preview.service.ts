import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import logger from '../logger';
import type { PreviewStartPayload, PreviewStartResult, OperationResult } from '../../src/common/ipc';

type ChildSession = {
  kind: 'child';
  process: ChildProcess;
};

type ViteSession = {
  kind: 'vite';
  server: { close: () => Promise<void> };
};

type Session = {
  workspacePath: string;
  port: number;
  url: string;
} & (ChildSession | ViteSession);

const sessions = new Map<string, Session>();

function isPortAvailable(): Promise<number> {
  return new Promise((resolve) => {
    import('node:net').then((net) => {
      const srv = net.createServer();
      srv.listen(0, () => {
        const port = (srv.address() as { port: number }).port;
        srv.close(() => resolve(port));
      });
    });
  });
}

type ViteModule = {
  createServer: (config: Record<string, unknown>) => Promise<{
    listen: (port?: number) => Promise<{
      resolvedUrls?: { local?: string[] };
      config?: { server?: { port?: number } };
    }>;
    close: () => Promise<void>;
  }>;
};

async function loadWorkspaceVite(workspacePath: string): Promise<ViteModule | null> {
  const candidate = path.join(workspacePath, 'node_modules', 'vite', 'dist', 'node', 'index.js');
  if (!existsSync(candidate)) {
    return null;
  }
  try {
    const mod = (await import(pathToFileURL(candidate).href)) as ViteModule;
    if (typeof mod.createServer === 'function') {
      return mod;
    }
  } catch (err) {
    logger.debug('[preview] failed to load workspace vite', err);
  }
  return null;
}

async function startWithViteApi(
  payload: PreviewStartPayload,
  vite: ViteModule,
  port: number
): Promise<PreviewStartResult> {
  try {
    const server = await vite.createServer({
      root: payload.workspacePath,
      configFile: undefined,
      server: { port, host: '127.0.0.1', strictPort: true }
    });
    const listening = await server.listen(port);
    const resolvedPort = listening.config?.server?.port ?? port;
    const url = listening.resolvedUrls?.local?.[0] ?? `http://127.0.0.1:${resolvedPort}/`;
    sessions.set(payload.workspacePath, {
      kind: 'vite',
      workspacePath: payload.workspacePath,
      port: resolvedPort,
      url,
      server
    });
    return { ok: true, port: resolvedPort, url };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function startWithChildProcess(payload: PreviewStartPayload, port: number): PreviewStartResult {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = ['run', 'dev', '--', '--port', String(port), '--host', '127.0.0.1'];
  let proc: ChildProcess;
  try {
    proc = spawn(command, args, {
      cwd: payload.workspacePath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, BROWSER: 'none' }
    });
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  const url = `http://localhost:${port}/`;
  proc.stdout?.on('data', (d: Buffer) => logger.debug('[preview]', d.toString()));
  proc.stderr?.on('data', (d: Buffer) => logger.debug('[preview err]', d.toString()));
  proc.on('exit', () => sessions.delete(payload.workspacePath));
  sessions.set(payload.workspacePath, {
    kind: 'child',
    workspacePath: payload.workspacePath,
    port,
    url,
    process: proc
  });
  return { ok: true, port, url };
}

export async function start(payload: PreviewStartPayload): Promise<PreviewStartResult> {
  if (sessions.has(payload.workspacePath)) {
    const existing = sessions.get(payload.workspacePath)!;
    return { ok: true, port: existing.port, url: existing.url };
  }
  const pkg = path.join(payload.workspacePath, 'package.json');
  if (!existsSync(pkg)) {
    return { ok: false, error: 'No package.json in workspace; cannot start preview.' };
  }

  const port = await isPortAvailable();

  const vite = await loadWorkspaceVite(payload.workspacePath);
  if (vite) {
    const result = await startWithViteApi(payload, vite, port);
    if (result.ok) {
      return result;
    }
    logger.warn('[preview] vite programmatic start failed; falling back to npm run dev');
  }

  return startWithChildProcess(payload, port);
}

export async function stop(workspacePath: string): Promise<OperationResult> {
  const session = sessions.get(workspacePath);
  if (!session) return { ok: true };
  try {
    if (session.kind === 'child') {
      session.process.kill();
    } else {
      await session.server.close();
    }
  } catch {
    // ignore shutdown errors
  }
  sessions.delete(workspacePath);
  return { ok: true };
}

export async function stopAll(): Promise<void> {
  await Promise.all(
    [...sessions.values()].map(async (session) => {
      try {
        if (session.kind === 'child') {
          session.process.kill();
        } else {
          await session.server.close();
        }
      } catch {
        // ignore
      }
    })
  );
  sessions.clear();
}
