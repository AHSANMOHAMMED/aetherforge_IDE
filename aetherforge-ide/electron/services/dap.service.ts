import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { WebContents } from 'electron';
import logger from '../logger';
import { IPCChannels, type DapLaunchPayload, type DapLaunchResult } from '../../src/common/ipc';

/**
 * Debug Adapter Protocol host.
 *
 * Same general shape as LSP host: spawn a child adapter process, frame
 * Content-Length-prefixed JSON-RPC messages over stdio, ferry them to the
 * renderer.
 */

type Session = {
  id: string;
  process: ChildProcess;
  type: string;
  buffer: Buffer;
};

const sessions = new Map<string, Session>();

function findAdapter(type: string): { command: string; args: string[] } | null {
  switch (type) {
    case 'node':
    case 'chrome':
      return { command: 'js-debug', args: [] };
    case 'python':
    case 'debugpy':
      return { command: 'python', args: ['-m', 'debugpy.adapter'] };
    case 'rust':
    case 'lldb':
      return { command: 'codelldb', args: [] };
    default:
      return null;
  }
}

function parseMessages(buffer: Buffer): { messages: unknown[]; rest: Buffer } {
  const messages: unknown[] = [];
  let rest = buffer;
  while (rest.length > 0) {
    const headerEnd = rest.indexOf('\r\n\r\n');
    if (headerEnd < 0) break;
    const header = rest.slice(0, headerEnd).toString('utf-8');
    const m = /Content-Length:\s*(\d+)/i.exec(header);
    if (!m) {
      rest = rest.slice(headerEnd + 4);
      continue;
    }
    const len = parseInt(m[1], 10);
    if (rest.length < headerEnd + 4 + len) break;
    const body = rest.slice(headerEnd + 4, headerEnd + 4 + len).toString('utf-8');
    try {
      messages.push(JSON.parse(body));
    } catch (err) {
      logger.warn('DAP malformed JSON', err);
    }
    rest = rest.slice(headerEnd + 4 + len);
  }
  return { messages, rest };
}

function frame(message: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(message), 'utf-8');
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'utf-8'), body]);
}

export async function launch(payload: DapLaunchPayload, webContents: WebContents): Promise<DapLaunchResult> {
  const spec = findAdapter(payload.type);
  if (!spec) return { ok: false, error: `No debug adapter registered for "${payload.type}"` };

  let proc: ChildProcess;
  try {
    proc = spawn(spec.command, spec.args, { cwd: payload.workspacePath, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err) {
    return { ok: false, error: `Could not spawn DAP "${spec.command}": ${(err as Error).message}` };
  }

  const id = randomUUID();
  const session: Session = { id, process: proc, type: payload.type, buffer: Buffer.alloc(0) };
  sessions.set(id, session);

  proc.stdout?.on('data', (chunk: Buffer) => {
    session.buffer = Buffer.concat([session.buffer, chunk]);
    const { messages, rest } = parseMessages(session.buffer);
    session.buffer = rest;
    for (const message of messages) {
      if (!webContents.isDestroyed()) {
        webContents.send(IPCChannels.DapEvent, { sessionId: id, message });
      }
    }
  });
  proc.stderr?.on('data', (chunk: Buffer) => logger.debug(`[dap:${payload.type}] ${chunk.toString()}`));
  proc.on('exit', () => sessions.delete(id));

  // initial DAP initialize + launch sequence
  const initMessage = {
    seq: 1,
    type: 'request',
    command: 'initialize',
    arguments: {
      clientID: 'aetherforge',
      adapterID: payload.type,
      pathFormat: 'path',
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsVariableType: true,
      supportsRunInTerminalRequest: false
    }
  };
  proc.stdin?.write(frame(initMessage));
  const launchMessage = {
    seq: 2,
    type: 'request',
    command: payload.request,
    arguments: payload.configuration
  };
  proc.stdin?.write(frame(launchMessage));

  return { ok: true, sessionId: id };
}

export function send(sessionId: string, message: unknown): boolean {
  const session = sessions.get(sessionId);
  if (!session || !session.process.stdin) return false;
  session.process.stdin.write(frame(message));
  return true;
}

export function terminate(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  session.process.kill();
  sessions.delete(sessionId);
  return true;
}

export function terminateAll(): void {
  for (const s of sessions.values()) {
    try {
      s.process.kill();
    } catch {
      // ignore
    }
  }
  sessions.clear();
}
