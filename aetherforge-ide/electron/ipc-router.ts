import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import logger from './logger';
import type { OperationResult } from '../src/common/ipc';

type Handler<P, R> = (payload: P, event: IpcMainInvokeEvent) => Promise<R> | R;

const senderAllowList = new Set<number>();

export function allowSender(webContentsId: number): void {
  senderAllowList.add(webContentsId);
}

export function clearAllowed(): void {
  senderAllowList.clear();
}

function validateSender(event: IpcMainInvokeEvent): boolean {
  // Reject IPC from any frame other than the trusted renderer top-level frame.
  const senderId = event.sender.id;
  if (!senderAllowList.has(senderId)) {
    logger.warn('Rejected IPC from unknown sender id', senderId);
    return false;
  }
  return true;
}

export function registerHandler<P, R>(
  channel: string,
  schema: z.ZodType<P> | null,
  handler: Handler<P, R>,
  options?: { sensitive?: boolean }
): void {
  ipcMain.handle(channel, async (event, raw): Promise<R | OperationResult> => {
    if (!validateSender(event)) {
      return { ok: false, error: 'IPC sender not authorized' } as never;
    }
    let payload: P;
    if (schema) {
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        const err = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        if (!options?.sensitive) {
          logger.warn(`IPC payload validation failed on ${channel}`, err);
        }
        return { ok: false, error: `Invalid payload: ${err}` } as never;
      }
      payload = parsed.data;
    } else {
      payload = raw as P;
    }
    try {
      return await handler(payload, event);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Handler ${channel} threw`, err);
      return { ok: false, error: message } as never;
    }
  });
}

export function safeOk(): OperationResult {
  return { ok: true };
}
export function safeErr(error: unknown): OperationResult {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}
