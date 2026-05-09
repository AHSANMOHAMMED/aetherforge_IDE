import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, shell, session as electronSession } from 'electron';
import * as Sentry from '@sentry/electron/main';
import logger, { initLogger } from './logger';
import { allowSender, registerHandler } from './ipc-router';
import { IPCChannels, type WriteFilePayload } from '../src/common/ipc';
import {
  AnalyzeUrlPayloadSchema,
  CreateFilePayloadSchema,
  CreateFolderPayloadSchema,
  DapLaunchPayloadSchema,
  DbExecutePayloadSchema,
  DeletePathPayloadSchema,
  ExportCanvasPayloadSchema,
  GitBlamePayloadSchema,
  GitBranchCheckoutPayloadSchema,
  GitBranchCreatePayloadSchema,
  GitCommitPayloadSchema,
  GitDiffPayloadSchema,
  GitLogPayloadSchema,
  GitPullPayloadSchema,
  GitPushPayloadSchema,
  GitStagePayloadSchema,
  LspMessagePayloadSchema,
  LspStartPayloadSchema,
  MovePathPayloadSchema,
  PluginInstallFromUrlPayloadSchema,
  PluginInstallPayloadSchema,
  PluginUninstallPayloadSchema,
  PreviewAttachViewPayloadSchema,
  PreviewSetBoundsPayloadSchema,
  PreviewStartPayloadSchema,
  RenamePathPayloadSchema,
  RunTerminalPayloadSchema,
  ScaffoldFullstackPayloadSchema,
  SearchInFilesPayloadSchema,
  SecretGetPayloadSchema,
  SecretSetPayloadSchema,
  SecretsSetMasterPayloadSchema,
  SecretsUnlockPayloadSchema,
  TelemetryEventPayloadSchema,
  TerminalCreatePayloadSchema,
  TerminalDisposePayloadSchema,
  TerminalResizePayloadSchema,
  TerminalWritePayloadSchema,
  WatchWorkspacePayloadSchema,
  WriteFilePayloadSchema
} from '../src/common/ipc-schemas';
import {
  createFile,
  createFolder,
  deletePath,
  movePath,
  readFileMeta,
  renamePath,
  setAllowedRoots,
  writeTextFile
} from '../src/services/file.service';
import {
  readWorkspaceTree,
  startWatcher,
  stopAllWatchers,
  stopWatcher
} from '../src/services/workspace.service';
import * as terminalService from './services/terminal.service';
import * as gitService from './services/git.service';
import * as secretsService from './services/secrets.service';
import * as searchService from './services/search.service';
import * as scaffoldService from './services/scaffold.service';
import * as playwrightService from './services/playwright.service';
import * as pluginService from './services/plugin.service';
import * as updaterService from './services/updater.service';
import * as dbService from './services/db.service';
import * as lspService from './services/lsp.service';
import * as dapService from './services/dap.service';
import * as previewService from './services/preview.service';
import * as previewViewService from './services/preview-view.service';
import * as extensionHostService from './services/extension-host.service';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { sanitizeCommandOutput, validateCommand } from './command-safety';
import os from 'node:os';

const execAsync = promisify(execCb);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !app.isPackaged;

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: isDev ? 'development' : 'production'
  });
}

let mainWindow: BrowserWindow | null = null;

function setupSecurityPolicies(): void {
  // Strict CSP for the renderer.
  electronSession.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self';",
          "script-src 'self' 'unsafe-eval' blob:;",
          "style-src 'self' 'unsafe-inline';",
          "img-src 'self' data: blob: https:;",
          "font-src 'self' data:;",
          "connect-src 'self' https: wss: http://localhost:* ws://localhost:*;",
          "worker-src 'self' blob:;",
          "frame-src 'self' http://localhost:* https://localhost:*;"
        ].join(' ')
      }
    });
  });

  // Block opening external windows; route to default browser.
  electronSession.defaultSession.setPermissionRequestHandler((_w, permission, cb) => {
    const allowed = ['clipboard-read', 'clipboard-sanitized-write', 'media'];
    cb(allowed.includes(permission));
  });
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'AetherForge IDE',
    backgroundColor: '#0B1220',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: false,
      spellcheck: false
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(process.env.DIST ?? path.join(__dirname, '../dist'), 'index.html'));
  }

  win.once('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    const allowed =
      url.startsWith('http://localhost') ||
      url.startsWith('https://localhost') ||
      url === process.env.VITE_DEV_SERVER_URL;
    if (!allowed) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  allowSender(win.webContents.id);

  // bind one-time updater
  updaterService.bindUpdater(win.webContents);

  return win;
}

function registerIpcHandlers(window: BrowserWindow): void {
  // Core
  registerHandler(IPCChannels.Ping, null, async () => ({
    ok: true,
    message: isDev ? 'pong (dev)' : 'pong (prod)',
    timestamp: Date.now()
  }));

  registerHandler(IPCChannels.AppInfo, null, async () => ({
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron ?? '',
    node: process.versions.node ?? '',
    chrome: process.versions.chrome ?? '',
    isPackaged: app.isPackaged,
    userDataDir: app.getPath('userData')
  }));

  // Workspace
  registerHandler(IPCChannels.OpenWorkspaceDialog, null, async () => {
    const response = await dialog.showOpenDialog(window, {
      title: 'Open Workspace Folder',
      properties: ['openDirectory']
    });
    const chosen = response.canceled ? null : (response.filePaths[0] ?? null);
    if (chosen) {
      setAllowedRoots([chosen]);
    }
    return { canceled: response.canceled, path: chosen };
  });

  registerHandler<string, unknown>(IPCChannels.ReadWorkspaceTree, null, async (workspacePath) => {
    setAllowedRoots([workspacePath]);
    return readWorkspaceTree(workspacePath);
  });

  registerHandler(IPCChannels.WatchWorkspace, WatchWorkspacePayloadSchema, async (payload) => {
    setAllowedRoots([payload.workspacePath]);
    startWatcher(payload.workspacePath, (event) => {
      if (!window.webContents.isDestroyed()) {
        window.webContents.send(IPCChannels.WorkspaceEvent, event);
      }
    });
    return { ok: true } as const;
  });

  registerHandler(IPCChannels.UnwatchWorkspace, WatchWorkspacePayloadSchema, async (payload) => {
    await stopWatcher(payload.workspacePath);
    return { ok: true } as const;
  });

  // FS
  registerHandler<string, unknown>(IPCChannels.ReadFile, null, async (filePath) => {
    const meta = await readFileMeta(filePath);
    return { content: meta.content, encoding: 'utf-8' as const, size: meta.size, mtime: meta.mtime };
  });

  registerHandler(IPCChannels.WriteFile, WriteFilePayloadSchema, async (payload: WriteFilePayload) => {
    await writeTextFile(payload.path, payload.content);
    return { ok: true } as const;
  });

  registerHandler(IPCChannels.CreateFile, CreateFilePayloadSchema, async (payload) => {
    await createFile(payload.directoryPath, payload.fileName);
    return { ok: true } as const;
  });

  registerHandler(IPCChannels.CreateFolder, CreateFolderPayloadSchema, async (payload) => {
    await createFolder(payload.directoryPath, payload.folderName);
    return { ok: true } as const;
  });

  registerHandler(IPCChannels.RenamePath, RenamePathPayloadSchema, async (payload) => {
    await renamePath(payload.targetPath, payload.newName);
    return { ok: true } as const;
  });

  registerHandler(IPCChannels.MovePath, MovePathPayloadSchema, async (payload) => {
    await movePath(payload.sourcePath, payload.destinationPath);
    return { ok: true } as const;
  });

  registerHandler(IPCChannels.DeletePath, DeletePathPayloadSchema, async (payload) => {
    await deletePath(payload.targetPath);
    return { ok: true } as const;
  });

  registerHandler<string, unknown>(IPCChannels.RevealInFinder, null, async (targetPath) => {
    shell.showItemInFolder(targetPath);
    return { ok: true } as const;
  });

  registerHandler(IPCChannels.SearchInFiles, SearchInFilesPayloadSchema, async (payload) => {
    return searchService.searchInFiles(payload);
  });

  // Terminal (PTY)
  registerHandler(IPCChannels.TerminalCreate, TerminalCreatePayloadSchema, async (payload) => {
    try {
      const result = await terminalService.createSession(window.webContents, payload);
      return { ok: true, ...result };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  registerHandler(IPCChannels.TerminalWrite, TerminalWritePayloadSchema, async (payload) => {
    const ok = terminalService.writeToSession(payload.id, payload.data);
    return ok ? { ok: true } : { ok: false, error: 'Session not found' };
  });
  registerHandler(IPCChannels.TerminalResize, TerminalResizePayloadSchema, async (payload) => {
    const ok = terminalService.resizeSession(payload.id, payload.cols, payload.rows);
    return ok ? { ok: true } : { ok: false, error: 'Session not found' };
  });
  registerHandler(IPCChannels.TerminalDispose, TerminalDisposePayloadSchema, async (payload) => {
    const ok = terminalService.disposeSession(payload.id);
    return ok ? { ok: true } : { ok: false, error: 'Session not found' };
  });

  // Legacy AI command runner (kept for backward compat - bounded by allowlist)
  registerHandler(IPCChannels.RunTerminalCommand, RunTerminalPayloadSchema, async (payload) => {
    const command = (payload.command ?? '').trim();
    if (!command) return { ok: false, stdout: '', stderr: '', exitCode: 1, error: 'Command is required' };
    if (!validateCommand(command)) {
      return { ok: false, stdout: '', stderr: '', exitCode: 1, error: 'Command not in allowed list' };
    }
    try {
      const timeoutMs = Math.max(1000, Math.min(payload.timeoutMs ?? 90_000, 300_000));
      const cwd = payload.cwd?.trim() || os.homedir();
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: timeoutMs,
        maxBuffer: 2 * 1024 * 1024
      });
      return {
        ok: true,
        stdout: sanitizeCommandOutput(stdout),
        stderr: sanitizeCommandOutput(stderr),
        exitCode: 0
      };
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; code?: number; message?: string };
      return {
        ok: false,
        stdout: sanitizeCommandOutput(e.stdout ?? ''),
        stderr: sanitizeCommandOutput(e.stderr ?? ''),
        exitCode: typeof e.code === 'number' ? e.code : 1,
        error: e.message ?? 'Terminal command failed'
      };
    }
  });

  registerHandler(IPCChannels.AnalyzeUrlWithPlaywright, AnalyzeUrlPayloadSchema, async (payload) => {
    return playwrightService.analyzeUrl(payload);
  });

  // Secrets
  registerHandler(
    IPCChannels.SecretsSet,
    SecretSetPayloadSchema,
    async (payload) => {
      try {
        await secretsService.setSecret(payload.key, payload.value);
        return { ok: true } as const;
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Failed to persist secret' };
      }
    },
    { sensitive: true }
  );

  registerHandler(
    IPCChannels.SecretsGet,
    SecretGetPayloadSchema,
    async (payload) => {
      const result = await secretsService.getSecret(payload.key);
      if (result.locked) return { ok: false, locked: true, error: 'Secret store is locked' };
      return { ok: true, value: result.value ?? '' };
    },
    { sensitive: true }
  );

  registerHandler(IPCChannels.SecretsDelete, SecretGetPayloadSchema, async (payload) => {
    await secretsService.deleteSecret(payload.key);
    return { ok: true } as const;
  });

  registerHandler(IPCChannels.SecretsHasMaster, null, async () => {
    return { ok: true, hasMaster: await secretsService.hasMasterPassphrase() };
  });

  registerHandler(IPCChannels.SecretsSetMaster, SecretsSetMasterPayloadSchema, async (payload) => {
    await secretsService.setMasterPassphrase(payload.passphrase);
    return { ok: true } as const;
  });

  registerHandler(IPCChannels.SecretsUnlock, SecretsUnlockPayloadSchema, async (payload) => {
    const ok = await secretsService.unlock(payload.passphrase);
    return ok ? { ok: true } : { ok: false, error: 'Invalid passphrase' };
  });

  // Scaffolders
  registerHandler(IPCChannels.ScaffoldFullstackProject, ScaffoldFullstackPayloadSchema, async (payload) => {
    return scaffoldService.scaffoldFullstackProject(payload);
  });

  registerHandler(IPCChannels.ExportCanvas, ExportCanvasPayloadSchema, async (payload) => {
    return scaffoldService.exportCanvas(payload);
  });

  // Plugins
  registerHandler(IPCChannels.PluginScan, null, async () => pluginService.scan());
  registerHandler<string, unknown>(IPCChannels.PluginLoadBundle, null, async (id) =>
    pluginService.loadBundle(id)
  );
  registerHandler(IPCChannels.PluginInstallFromPath, PluginInstallPayloadSchema, async (payload) =>
    pluginService.installFromPath(payload)
  );
  registerHandler(IPCChannels.PluginInstallFromUrl, PluginInstallFromUrlPayloadSchema, async (payload) =>
    pluginService.installFromUrl(payload)
  );
  registerHandler(IPCChannels.PluginUninstall, PluginUninstallPayloadSchema, async (payload) =>
    pluginService.uninstall(payload)
  );
  registerHandler(IPCChannels.PluginVerify, PluginUninstallPayloadSchema, async (payload) =>
    pluginService.verify(payload)
  );

  // Git
  registerHandler<string, unknown>(IPCChannels.GitGetStatus, null, async (workspacePath) =>
    gitService.getStatus(workspacePath)
  );
  registerHandler(IPCChannels.GitGetLog, GitLogPayloadSchema, async (payload) => gitService.getLog(payload));
  registerHandler(IPCChannels.GitGetDiff, GitDiffPayloadSchema, async (payload) =>
    gitService.getDiff(payload)
  );
  registerHandler(IPCChannels.GitStage, GitStagePayloadSchema, async (payload) => gitService.stage(payload));
  registerHandler(IPCChannels.GitUnstage, GitStagePayloadSchema, async (payload) =>
    gitService.unstage(payload)
  );
  registerHandler(IPCChannels.GitCommit, GitCommitPayloadSchema, async (payload) =>
    gitService.commit(payload)
  );
  registerHandler(IPCChannels.GitPush, GitPushPayloadSchema, async (payload) => gitService.push(payload));
  registerHandler(IPCChannels.GitPull, GitPullPayloadSchema, async (payload) => gitService.pull(payload));
  registerHandler<string, unknown>(IPCChannels.GitBranchList, null, async (workspacePath) =>
    gitService.branchList(workspacePath)
  );
  registerHandler(IPCChannels.GitBranchCreate, GitBranchCreatePayloadSchema, async (payload) =>
    gitService.branchCreate(payload)
  );
  registerHandler(IPCChannels.GitBranchCheckout, GitBranchCheckoutPayloadSchema, async (payload) =>
    gitService.branchCheckout(payload)
  );
  registerHandler(IPCChannels.GitBlame, GitBlamePayloadSchema, async (payload) => gitService.blame(payload));

  // LSP
  registerHandler(IPCChannels.LspStart, LspStartPayloadSchema, async (payload) =>
    lspService.start(payload, window.webContents)
  );
  registerHandler<string, unknown>(IPCChannels.LspStop, null, async (sessionId) => {
    const ok = lspService.stop(sessionId);
    return ok ? { ok: true } : { ok: false, error: 'Session not found' };
  });
  registerHandler(IPCChannels.LspRequest, LspMessagePayloadSchema, async (payload) => {
    const ok = lspService.send(payload);
    return ok ? { ok: true } : { ok: false, error: 'Session not found' };
  });
  registerHandler(IPCChannels.LspNotification, LspMessagePayloadSchema, async (payload) => {
    const ok = lspService.send(payload);
    return ok ? { ok: true } : { ok: false, error: 'Session not found' };
  });

  // DAP
  registerHandler(IPCChannels.DapLaunch, DapLaunchPayloadSchema, async (payload) =>
    dapService.launch(payload, window.webContents)
  );
  registerHandler<string, unknown>(IPCChannels.DapTerminate, null, async (sessionId) => {
    const ok = dapService.terminate(sessionId);
    return ok ? { ok: true } : { ok: false, error: 'Session not found' };
  });
  registerHandler(IPCChannels.DapRequest, LspMessagePayloadSchema, async (payload) => {
    const ok = dapService.send(payload.sessionId, payload.message);
    return ok ? { ok: true } : { ok: false, error: 'Session not found' };
  });

  // Preview
  registerHandler(IPCChannels.PreviewStart, PreviewStartPayloadSchema, async (payload) =>
    previewService.start(payload)
  );
  registerHandler<string, unknown>(
    IPCChannels.PreviewStop,
    null,
    async (workspacePath) => await previewService.stop(workspacePath)
  );
  registerHandler(IPCChannels.PreviewAttachView, PreviewAttachViewPayloadSchema, async (payload) => {
    if (!mainWindow) {
      return { ok: false, error: 'No window available' } as const;
    }
    await previewViewService.attachView(mainWindow, payload);
    return { ok: true } as const;
  });
  registerHandler(IPCChannels.PreviewSetBounds, PreviewSetBoundsPayloadSchema, async (payload) => {
    previewViewService.setBounds(payload);
    return { ok: true } as const;
  });
  registerHandler(IPCChannels.PreviewDetachView, null, async () => {
    previewViewService.detachView();
    return { ok: true } as const;
  });

  // DB
  registerHandler(IPCChannels.DbExecute, DbExecutePayloadSchema, async (payload) => {
    try {
      dbService.getDb().exec(payload.sql, payload.params);
      return { ok: true } as const;
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'DB exec failed' };
    }
  });
  registerHandler(IPCChannels.DbQuery, DbExecutePayloadSchema, async (payload) => {
    try {
      const rows = dbService.getDb().query(payload.sql, payload.params);
      return { ok: true as const, rows };
    } catch (err) {
      return { ok: false as const, rows: [], error: err instanceof Error ? err.message : 'DB query failed' };
    }
  });

  // Updates
  registerHandler(IPCChannels.UpdateCheck, null, async () => {
    await updaterService.check();
    return { ok: true } as const;
  });
  registerHandler(IPCChannels.UpdateDownload, null, async () => {
    await updaterService.download();
    return { ok: true } as const;
  });
  registerHandler(IPCChannels.UpdateInstall, null, async () => {
    updaterService.install();
    return { ok: true } as const;
  });

  // Telemetry
  registerHandler(IPCChannels.TelemetryEvent, TelemetryEventPayloadSchema, async (payload) => {
    logger.info('telemetry', payload.name, payload.properties ?? {});
    return { ok: true } as const;
  });
}

app.whenReady().then(async () => {
  initLogger();
  setupSecurityPolicies();
  await dbService.initDb();
  mainWindow = createMainWindow();
  registerIpcHandlers(mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
      registerIpcHandlers(mainWindow);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  terminalService.disposeAll();
  lspService.stopAll();
  dapService.terminateAll();
  await previewService.stopAll();
  previewViewService.disposeView();
  extensionHostService.stopAllExtensionHosts();
  await stopAllWatchers();
  await dbService.closeDb();
});
