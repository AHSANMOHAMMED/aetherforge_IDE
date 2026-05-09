import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { WebContents } from 'electron';
import logger from '../logger';
import {
  IPCChannels,
  type LspMessagePayload,
  type LspStartPayload,
  type LspStartResult
} from '../../src/common/ipc';

/**
 * Language Server Protocol host.
 *
 * Spawns one LSP server per (language, workspace) pair as a child process
 * communicating over stdio with JSON-RPC content-length-framed messages.
 * Messages are forwarded to the renderer where monaco-languageclient handles
 * them. Server discovery prefers workspace `node_modules/.bin`; otherwise we
 * fall back to PATH lookup.
 */

type Session = {
  id: string;
  language: string;
  process: ChildProcess;
  workspace: string;
  buffer: Buffer;
};

const sessions = new Map<string, Session>();

type ServerSpec = { command: string; args: string[]; bin?: string };

function findServer(language: string, workspace: string): ServerSpec | null {
  const localBin = (cmd: string) => path.join(workspace, 'node_modules', '.bin', cmd);
  switch (language) {
    case 'typescript':
    case 'javascript':
      return {
        command: localBin('typescript-language-server'),
        args: ['--stdio'],
        bin: 'typescript-language-server'
      };
    case 'python':
      return { command: 'pyright-langserver', args: ['--stdio'] };
    case 'rust':
      return { command: 'rust-analyzer', args: [] };
    case 'go':
      return { command: 'gopls', args: ['serve'] };
    case 'lua':
      return { command: 'lua-language-server', args: [] };
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
      // unrecoverable
      rest = rest.slice(headerEnd + 4);
      continue;
    }
    const len = parseInt(m[1], 10);
    const totalLen = headerEnd + 4 + len;
    if (rest.length < totalLen) break;
    const body = rest.slice(headerEnd + 4, totalLen).toString('utf-8');
    try {
      messages.push(JSON.parse(body));
    } catch (err) {
      logger.warn('LSP malformed JSON', err);
    }
    rest = rest.slice(totalLen);
  }
  return { messages, rest };
}

function frame(message: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(message), 'utf-8');
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'utf-8'), body]);
}

export async function start(payload: LspStartPayload, webContents: WebContents): Promise<LspStartResult> {
  const spec = findServer(payload.language, payload.workspacePath);
  if (!spec) {
    return { ok: false, error: `No LSP server registered for "${payload.language}"` };
  }

  let proc: ChildProcess;
  try {
    proc = spawn(spec.command, spec.args, {
      cwd: payload.workspacePath,
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (err) {
    return { ok: false, error: `Could not spawn LSP "${spec.command}": ${(err as Error).message}` };
  }

  const id = randomUUID();
  const session: Session = {
    id,
    language: payload.language,
    process: proc,
    workspace: payload.workspacePath,
    buffer: Buffer.alloc(0)
  };
  sessions.set(id, session);

  proc.stdout?.on('data', (chunk: Buffer) => {
    session.buffer = Buffer.concat([session.buffer, chunk]);
    const { messages, rest } = parseMessages(session.buffer);
    session.buffer = rest;
    for (const message of messages) {
      const event: LspMessagePayload = { sessionId: id, message };
      if (!webContents.isDestroyed()) {
        webContents.send(IPCChannels.LspMessage, event);
      }
    }
  });
  proc.stderr?.on('data', (chunk: Buffer) => logger.debug(`[lsp:${payload.language}] ${chunk.toString()}`));
  proc.on('exit', (code) => {
    sessions.delete(id);
    logger.info(`LSP ${payload.language} (${id}) exited`, code);
  });
  proc.on('error', (err) => logger.error(`LSP ${payload.language} (${id}) error`, err));

  return { ok: true, sessionId: id };
}

export function send(payload: LspMessagePayload): boolean {
  const session = sessions.get(payload.sessionId);
  if (!session || !session.process.stdin) return false;
  session.process.stdin.write(frame(payload.message));
  return true;
}

export function stop(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  session.process.kill();
  sessions.delete(sessionId);
  return true;
}

export function stopAll(): void {
  for (const s of sessions.values()) {
    try {
      s.process.kill();
    } catch {
      // ignore
    }
  }
  sessions.clear();
}
