import type { WebContents } from 'electron';
import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import logger from '../logger';
import { IPCChannels, type UpdateEvent } from '../../src/common/ipc';

let bound: WebContents | null = null;
let initialized = false;

function emit(event: UpdateEvent) {
  if (bound && !bound.isDestroyed()) bound.send(IPCChannels.UpdateEvent, event);
}

export function bindUpdater(webContents: WebContents): void {
  bound = webContents;
  if (initialized) return;
  initialized = true;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = logger;

  const rawChannel = (process.env.AF_UPDATE_CHANNEL ?? 'stable').toLowerCase();
  if (rawChannel === 'beta' || rawChannel === 'nightly') {
    autoUpdater.channel = rawChannel;
  } else {
    autoUpdater.channel = 'latest';
  }

  autoUpdater.on('checking-for-update', () => emit({ kind: 'checking' }));
  autoUpdater.on('update-available', (info) =>
    emit({
      kind: 'available',
      info: {
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
        releaseDate: info.releaseDate
      }
    })
  );
  autoUpdater.on('update-not-available', () => emit({ kind: 'not-available' }));
  autoUpdater.on('download-progress', (p) =>
    emit({
      kind: 'progress',
      percent: p.percent,
      bytesPerSecond: p.bytesPerSecond,
      transferred: p.transferred,
      total: p.total
    })
  );
  autoUpdater.on('update-downloaded', (info) =>
    emit({
      kind: 'downloaded',
      info: {
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
        releaseDate: info.releaseDate
      }
    })
  );
  autoUpdater.on('error', (err) => emit({ kind: 'error', error: err.message }));
}

export async function check(): Promise<void> {
  if (!app.isPackaged) {
    logger.info('Updater: skipping check in dev mode');
    return;
  }
  await autoUpdater.checkForUpdates();
}

export async function download(): Promise<void> {
  if (!app.isPackaged) return;
  await autoUpdater.downloadUpdate();
}

export function install(): void {
  if (!app.isPackaged) return;
  autoUpdater.quitAndInstall(false, true);
}
