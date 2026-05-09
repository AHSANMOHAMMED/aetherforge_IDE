import log from 'electron-log/main';
import path from 'node:path';
import { app } from 'electron';

let initialized = false;

export function initLogger(): void {
  if (initialized) return;
  initialized = true;
  log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs', 'aetherforge.log');
  log.transports.file.maxSize = 5 * 1024 * 1024;
  log.transports.file.level = app.isPackaged ? 'info' : 'debug';
  log.transports.console.level = app.isPackaged ? 'warn' : 'debug';
  log.errorHandler.startCatching({
    showDialog: false,
    onError: ({ error }) => {
      log.error('Uncaught error', error);
    }
  });
  log.info(`AetherForge starting v${app.getVersion()} on ${process.platform}/${process.arch}`);
}

export default log;
