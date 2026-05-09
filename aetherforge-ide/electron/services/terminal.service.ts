import os from 'node:os';
import { randomUUID } from 'node:crypto';
import type { WebContents } from 'electron';
import logger from '../logger';
import { IPCChannels, type TerminalDataEvent, type TerminalExitEvent } from '../../src/common/ipc';

type PtyProcess = {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
  onData(cb: (data: string) => void): void;
  onExit(cb: (e: { exitCode: number; signal?: number | null }) => void): void;
  pid: number;
};

type SessionOptions = {
  cwd?: string;
  shell?: string;
  cols?: number;
  rows?: number;
  env?: Record<string, string>;
};

type Session = {
  id: string;
  process: PtyProcess;
  shell: string;
};

const sessions = new Map<string, Session>();

let pty: typeof import('node-pty') | null = null;
async function loadPty(): Promise<typeof import('node-pty') | null> {
  if (pty) return pty;
  try {
    pty = await import('node-pty');
    return pty;
  } catch (err) {
    logger.warn('node-pty unavailable; terminal sessions will be disabled', err);
    return null;
  }
}

function defaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC ?? 'powershell.exe';
  }
  return process.env.SHELL ?? '/bin/bash';
}

export async function createSession(
  webContents: WebContents,
  options: SessionOptions
): Promise<{ id: string; pid: number; shell: string }> {
  const ptyMod = await loadPty();
  const shell = options.shell ?? defaultShell();
  const cwd = options.cwd ?? os.homedir();
  const id = randomUUID();

  if (!ptyMod) {
    // graceful degradation: report a fake session that will error on write
    sessions.set(id, {
      id,
      shell,
      process: {
        pid: -1,
        write: () => {
          /* no-op */
        },
        resize: () => {
          /* no-op */
        },
        kill: () => {
          /* no-op */
        },
        onData: () => {
          /* no-op */
        },
        onExit: () => {
          /* no-op */
        }
      }
    });
    return { id, pid: -1, shell };
  }

  const env = { ...(process.env as Record<string, string>), ...(options.env ?? {}), TERM: 'xterm-256color' };

  const proc = ptyMod.spawn(shell, [], {
    name: 'xterm-256color',
    cols: options.cols ?? 100,
    rows: options.rows ?? 30,
    cwd,
    env,
    encoding: 'utf-8'
  });

  const wrapped: PtyProcess = {
    pid: proc.pid,
    write: (d) => proc.write(d),
    resize: (c, r) => proc.resize(c, r),
    kill: (s) => proc.kill(s),
    onData: (cb) => proc.onData(cb),
    onExit: (cb) => proc.onExit(cb)
  };

  wrapped.onData((data) => {
    const event: TerminalDataEvent = { id, chunk: data };
    if (!webContents.isDestroyed()) {
      webContents.send(IPCChannels.TerminalData, event);
    }
  });
  wrapped.onExit(({ exitCode, signal }) => {
    sessions.delete(id);
    const event: TerminalExitEvent = { id, exitCode, signal: signal ?? null };
    if (!webContents.isDestroyed()) {
      webContents.send(IPCChannels.TerminalExit, event);
    }
  });

  sessions.set(id, { id, process: wrapped, shell });
  return { id, pid: wrapped.pid, shell };
}

export function writeToSession(id: string, data: string): boolean {
  const s = sessions.get(id);
  if (!s) return false;
  s.process.write(data);
  return true;
}

export function resizeSession(id: string, cols: number, rows: number): boolean {
  const s = sessions.get(id);
  if (!s) return false;
  s.process.resize(cols, rows);
  return true;
}

export function disposeSession(id: string): boolean {
  const s = sessions.get(id);
  if (!s) return false;
  try {
    s.process.kill();
  } catch {
    // ignore
  }
  sessions.delete(id);
  return true;
}

export function disposeAll(): void {
  for (const s of sessions.values()) {
    try {
      s.process.kill();
    } catch {
      // ignore
    }
  }
  sessions.clear();
}
