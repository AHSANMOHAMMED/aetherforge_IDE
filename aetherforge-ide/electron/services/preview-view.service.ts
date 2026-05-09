import { BrowserWindow, WebContentsView } from 'electron';
import logger from '../logger';
import type { PreviewAttachViewPayload, PreviewSetBoundsPayload } from '../../src/common/ipc';

let view: WebContentsView | null = null;
let attachedWindow: BrowserWindow | null = null;

function ensureView(): WebContentsView {
  if (!view) {
    view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
  }
  return view;
}

export async function attachView(window: BrowserWindow, payload: PreviewAttachViewPayload): Promise<void> {
  const targetView = ensureView();
  targetView.setBounds({
    x: Math.round(payload.bounds.x),
    y: Math.round(payload.bounds.y),
    width: Math.max(0, Math.round(payload.bounds.width)),
    height: Math.max(0, Math.round(payload.bounds.height))
  });

  if (attachedWindow !== window) {
    if (attachedWindow) {
      attachedWindow.contentView.removeChildView(targetView);
    }
    window.contentView.addChildView(targetView);
    attachedWindow = window;
  }

  try {
    await targetView.webContents.loadURL(payload.url);
  } catch (err) {
    logger.warn('[preview-view] loadURL failed', err);
  }
}

export function setBounds(payload: PreviewSetBoundsPayload): void {
  if (!view) return;
  view.setBounds({
    x: Math.round(payload.bounds.x),
    y: Math.round(payload.bounds.y),
    width: Math.max(0, Math.round(payload.bounds.width)),
    height: Math.max(0, Math.round(payload.bounds.height))
  });
}

export function detachView(): void {
  if (!view || !attachedWindow) return;
  try {
    attachedWindow.contentView.removeChildView(view);
  } catch (err) {
    logger.debug('[preview-view] removeChildView failed', err);
  }
  attachedWindow = null;
}

export function disposeView(): void {
  if (view) {
    detachView();
    try {
      (view.webContents as { close?: () => void }).close?.();
    } catch {
      // ignore
    }
    view = null;
  }
}
