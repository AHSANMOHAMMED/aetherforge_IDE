export enum IPCChannels {
  // Core
  Ping = 'core:ping',
  AppInfo = 'core:app-info',

  // Workspace
  OpenWorkspaceDialog = 'workspace:open-dialog',
  ReadWorkspaceTree = 'workspace:read-tree',
  WatchWorkspace = 'workspace:watch',
  UnwatchWorkspace = 'workspace:unwatch',
  WorkspaceEvent = 'workspace:event',

  // File system
  ReadFile = 'file:read',
  WriteFile = 'file:write',
  CreateFile = 'file:create',
  CreateFolder = 'folder:create',
  RenamePath = 'fs:rename',
  MovePath = 'fs:move',
  DeletePath = 'fs:delete',
  RevealInFinder = 'fs:reveal-in-finder',
  SearchInFiles = 'fs:search',
  SearchInFilesEvent = 'fs:search-event',

  // Terminal (PTY)
  TerminalCreate = 'terminal:create',
  TerminalWrite = 'terminal:write',
  TerminalResize = 'terminal:resize',
  TerminalDispose = 'terminal:dispose',
  TerminalData = 'terminal:data',
  TerminalExit = 'terminal:exit',
  // Legacy command runner (kept for AI tool calls)
  RunTerminalCommand = 'tool:terminal:run',

  // Tools / browser
  AnalyzeUrlWithPlaywright = 'tool:url:analyze',

  // Secrets
  SecretsSet = 'secrets:set',
  SecretsGet = 'secrets:get',
  SecretsDelete = 'secrets:delete',
  SecretsHasMaster = 'secrets:has-master',
  SecretsSetMaster = 'secrets:set-master',
  SecretsUnlock = 'secrets:unlock',

  // Generators
  ScaffoldFullstackProject = 'generator:scaffold-fullstack-project',
  ExportCanvas = 'generator:export-canvas',

  // Plugins
  PluginScan = 'plugin:scan',
  PluginLoadBundle = 'plugin:load-bundle',
  PluginInstallFromPath = 'plugin:install-from-path',
  PluginInstallFromUrl = 'plugin:install-from-url',
  PluginUninstall = 'plugin:uninstall',
  PluginVerify = 'plugin:verify',
  ExtHostRunBundle = 'exthost:run-bundle',
  ExtHostStop = 'exthost:stop',

  // Git
  GitGetStatus = 'git:get-status',
  GitGetLog = 'git:get-log',
  GitGetDiff = 'git:get-diff',
  GitStage = 'git:stage',
  GitUnstage = 'git:unstage',
  GitCommit = 'git:commit',
  GitPush = 'git:push',
  GitPull = 'git:pull',
  GitFetch = 'git:fetch',
  GitBranchList = 'git:branch-list',
  GitBranchCreate = 'git:branch-create',
  GitBranchCheckout = 'git:branch-checkout',
  GitBlame = 'git:blame',

  // LSP
  LspStart = 'lsp:start',
  LspStop = 'lsp:stop',
  LspRequest = 'lsp:request',
  LspNotification = 'lsp:notification',
  LspMessage = 'lsp:message',

  // DAP
  DapLaunch = 'dap:launch',
  DapTerminate = 'dap:terminate',
  DapRequest = 'dap:request',
  DapEvent = 'dap:event',

  // Preview
  PreviewStart = 'preview:start',
  PreviewStop = 'preview:stop',
  PreviewStatus = 'preview:status',
  PreviewAttachView = 'preview:attach-view',
  PreviewDetachView = 'preview:detach-view',
  PreviewSetBounds = 'preview:set-bounds',

  // Database (local SQLite)
  DbExecute = 'db:execute',
  DbQuery = 'db:query',

  // Updates
  UpdateCheck = 'update:check',
  UpdateDownload = 'update:download',
  UpdateInstall = 'update:install',
  UpdateEvent = 'update:event',

  // Telemetry
  TelemetryEvent = 'telemetry:event',

  // AI proxy (V3)
  AiProxyChat = 'ai-proxy:chat',
  AiProxyStream = 'ai-proxy:stream',

  // Marketplace
  MarketplaceCatalog = 'marketplace:catalog'
}

export type PingResponse = {
  ok: boolean;
  message: string;
  timestamp: number;
};

export type AppInfo = {
  version: string;
  platform: NodeJS.Platform;
  arch: string;
  electron: string;
  node: string;
  chrome: string;
  isPackaged: boolean;
  userDataDir: string;
};

export type FileNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
};

export type OpenWorkspaceDialogResult = {
  canceled: boolean;
  path: string | null;
};

export type OperationResult = {
  ok: boolean;
  error?: string;
};

export type ReadFileResult = {
  content: string;
  encoding: 'utf-8' | 'binary';
  size: number;
  mtime: number;
};

export type RunTerminalPayload = {
  command: string;
  cwd?: string;
  timeoutMs?: number;
};

export type RunTerminalResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
};

// ─── PTY terminal session ────────────────────────────────────────────────────
export type TerminalCreatePayload = {
  cwd?: string;
  shell?: string;
  cols?: number;
  rows?: number;
  env?: Record<string, string>;
};

export type TerminalCreateResult = {
  ok: boolean;
  id?: string;
  pid?: number;
  shell?: string;
  error?: string;
};

export type TerminalWritePayload = {
  id: string;
  data: string;
};

export type TerminalResizePayload = {
  id: string;
  cols: number;
  rows: number;
};

export type TerminalDisposePayload = {
  id: string;
};

export type TerminalDataEvent = {
  id: string;
  chunk: string;
};

export type TerminalExitEvent = {
  id: string;
  exitCode: number;
  signal?: number | null;
};

// ─── Workspace watcher ────────────────────────────────────────────────────────
export type WorkspaceEventKind = 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir' | 'ready' | 'error';
export type WorkspaceEvent = {
  workspacePath: string;
  kind: WorkspaceEventKind;
  path?: string;
  error?: string;
};

export type WatchWorkspacePayload = { workspacePath: string };
export type UnwatchWorkspacePayload = { workspacePath: string };

// ─── Search ──────────────────────────────────────────────────────────────────
export type SearchInFilesPayload = {
  workspacePath: string;
  query: string;
  includeGlobs?: string[];
  excludeGlobs?: string[];
  caseSensitive?: boolean;
  isRegex?: boolean;
  maxResults?: number;
};

export type SearchHit = {
  path: string;
  line: number;
  column: number;
  preview: string;
};

export type SearchInFilesResult = {
  ok: boolean;
  hits: SearchHit[];
  truncated: boolean;
  error?: string;
};

// ─── Git ─────────────────────────────────────────────────────────────────────
export type GitFileStatusEntry = {
  path: string;
  code: string;
};

export type GitStatusResult = {
  ok: boolean;
  branch: string;
  ahead?: number;
  behind?: number;
  entries: GitFileStatusEntry[];
  error?: string;
};

export type GitLogEntry = {
  hash: string;
  abbreviated: string;
  author: string;
  email: string;
  date: number;
  subject: string;
  body?: string;
};

export type GitLogPayload = { workspacePath: string; limit?: number; file?: string };
export type GitLogResult = { ok: boolean; entries: GitLogEntry[]; error?: string };

export type GitDiffPayload = { workspacePath: string; path?: string; staged?: boolean };
export type GitDiffResult = { ok: boolean; diff: string; error?: string };

export type GitStagePayload = { workspacePath: string; paths: string[] };
export type GitCommitPayload = { workspacePath: string; message: string; signoff?: boolean };
export type GitCommitResult = { ok: boolean; hash?: string; error?: string };

export type GitPushPayload = { workspacePath: string; remote?: string; branch?: string; force?: boolean };
export type GitPullPayload = { workspacePath: string; remote?: string; branch?: string };

export type GitBranchListResult = {
  ok: boolean;
  current: string;
  all: { name: string; remote: boolean; commit?: string }[];
  error?: string;
};

export type GitBranchCreatePayload = { workspacePath: string; name: string; checkout?: boolean };
export type GitBranchCheckoutPayload = { workspacePath: string; name: string };

export type GitBlameLine = { hash: string; author: string; date: number; line: number; content: string };
export type GitBlamePayload = { workspacePath: string; path: string };
export type GitBlameResult = { ok: boolean; lines: GitBlameLine[]; error?: string };

// ─── Browser tool ────────────────────────────────────────────────────────────
export type AnalyzeUrlPayload = { url: string };
export type AnalyzeUrlResult = {
  ok: boolean;
  title?: string;
  htmlSnippet?: string;
  uiSummary?: string;
  screenshotBase64?: string;
  error?: string;
};

// ─── Secrets ─────────────────────────────────────────────────────────────────
export type SecretSetPayload = { key: string; value: string };
export type SecretGetPayload = { key: string };
export type SecretGetResult = { ok: boolean; value?: string; locked?: boolean; error?: string };
export type SecretsHasMasterResult = { ok: boolean; hasMaster: boolean };
export type SecretsSetMasterPayload = { passphrase: string };
export type SecretsUnlockPayload = { passphrase: string };

// ─── Scaffolders ─────────────────────────────────────────────────────────────
export type ScaffoldFullstackPayload = {
  targetRoot: string;
  projectName: string;
  backend: 'express' | 'fastapi';
  database: 'prisma' | 'supabase' | 'both';
  overwrite?: boolean;
  generatedArtifacts?: {
    openApiJson?: string;
    prismaSchema?: string;
    supabaseSql?: string;
  };
};
export type ScaffoldFullstackResult = {
  ok: boolean;
  projectPath?: string;
  createdFiles: string[];
  error?: string;
};

export type ExportTarget = 'react' | 'nextjs' | 'flutter' | 'react-native';
export type ExportCanvasNode = {
  id: string;
  componentType: string;
  label: string;
  x: number;
  y: number;
  props: {
    text?: string;
    src?: string;
    className?: string;
    backgroundColor?: string;
    padding?: number;
    width?: number;
    height?: number;
  };
};
export type ExportCanvasPayload = {
  targetRoot: string;
  projectName: string;
  target: ExportTarget;
  nodes: ExportCanvasNode[];
  overwrite?: boolean;
};
export type ExportCanvasResult = {
  ok: boolean;
  projectPath?: string;
  createdFiles: string[];
  error?: string;
};

// ─── Plugins ─────────────────────────────────────────────────────────────────
export type PluginPermission =
  | 'workspace.read'
  | 'workspace.write'
  | 'commands'
  | 'canvas.read'
  | 'canvas.write'
  | 'terminal.run'
  | 'network'
  | 'secrets'
  | 'node';

export type PluginManifestRaw = {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  publisher?: string;
  publisherKey?: string;
  signature?: string;
  engines?: { aetherforge?: string; node?: string };
  permissions?: PluginPermission[];
  contributes?: {
    commands?: Array<{ id: string; title: string; keybinding?: string; category?: string }>;
    views?: Array<{ id: string; title: string; location?: 'main' | 'right' | 'sidebar' }>;
    languages?: Array<{ id: string; aliases?: string[]; extensions?: string[] }>;
    menus?: Record<string, Array<{ command: string; when?: string; group?: string }>>;
    keybindings?: Array<{ key: string; command: string; when?: string }>;
    settings?: Record<string, { type: string; default?: unknown; description?: string }>;
    snippets?: Array<{ language: string; path: string }>;
    themes?: Array<{ id: string; label: string; uiTheme: 'vs' | 'vs-dark' | 'hc-black'; path: string }>;
  };
  activationEvents?: string[];
};

export type PluginScanEntry = {
  id: string;
  manifest: PluginManifestRaw;
  installPath: string;
};
export type PluginScanResult = { ok: boolean; plugins: PluginScanEntry[]; error?: string };
export type PluginBundleResult = { ok: boolean; source?: string; error?: string };
export type PluginInstallPayload = { sourcePath: string };
export type PluginInstallFromUrlPayload = { url: string; expectedSignature?: string };
export type PluginInstallResult = { ok: boolean; id?: string; error?: string };
export type PluginUninstallPayload = { id: string };
export type PluginVerifyPayload = { id: string };
export type PluginVerifyResult = { ok: boolean; verified: boolean; publisher?: string; error?: string };
export type ExtHostRunBundlePayload = { pluginId: string; bundlePath: string };
export type ExtHostStopPayload = { pluginId: string };

// ─── FS payloads ─────────────────────────────────────────────────────────────
export type WriteFilePayload = { path: string; content: string };
export type CreateFilePayload = { directoryPath: string; fileName: string };
export type CreateFolderPayload = { directoryPath: string; folderName: string };
export type RenamePathPayload = { targetPath: string; newName: string };
export type MovePathPayload = { sourcePath: string; destinationPath: string };
export type DeletePathPayload = { targetPath: string };

// ─── Updates ─────────────────────────────────────────────────────────────────
export type UpdateInfo = {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
  channel?: 'stable' | 'beta' | 'nightly';
};
export type UpdateEvent =
  | { kind: 'checking' }
  | { kind: 'available'; info: UpdateInfo }
  | { kind: 'not-available' }
  | { kind: 'progress'; percent: number; bytesPerSecond: number; transferred: number; total: number }
  | { kind: 'downloaded'; info: UpdateInfo }
  | { kind: 'error'; error: string };

// ─── Preview ─────────────────────────────────────────────────────────────────
export type PreviewStartPayload = { workspacePath: string; mode?: 'vite' | 'static' };
export type PreviewStartResult = { ok: boolean; port?: number; url?: string; error?: string };
export type PreviewAttachViewPayload = {
  url: string;
  bounds: { x: number; y: number; width: number; height: number };
};
export type PreviewSetBoundsPayload = {
  bounds: { x: number; y: number; width: number; height: number };
};

// ─── DB ─────────────────────────────────────────────────────────────────────
export type DbExecutePayload = { sql: string; params?: unknown[] };
export type DbQueryResult<T = unknown> = { ok: boolean; rows: T[]; error?: string };

// ─── LSP ─────────────────────────────────────────────────────────────────────
export type LspStartPayload = { language: string; workspacePath: string };
export type LspStartResult = { ok: boolean; sessionId?: string; error?: string };
export type LspMessagePayload = { sessionId: string; message?: unknown };

// ─── DAP ─────────────────────────────────────────────────────────────────────
export type DapLaunchPayload = {
  workspacePath: string;
  type: string;
  request: 'launch' | 'attach';
  configuration: Record<string, unknown>;
};
export type DapLaunchResult = { ok: boolean; sessionId?: string; error?: string };

// ─── Telemetry ───────────────────────────────────────────────────────────────
export type TelemetryEventPayload = {
  name: string;
  properties?: Record<string, string | number | boolean | null>;
};

// ─── ElectronAPI ─────────────────────────────────────────────────────────────
export type ElectronAPI = {
  // Core
  ping: () => Promise<PingResponse>;
  appInfo: () => Promise<AppInfo>;

  // Workspace + FS
  openWorkspaceDialog: () => Promise<OpenWorkspaceDialogResult>;
  readWorkspaceTree: (workspacePath: string) => Promise<FileNode[]>;
  watchWorkspace: (payload: WatchWorkspacePayload) => Promise<OperationResult>;
  unwatchWorkspace: (payload: UnwatchWorkspacePayload) => Promise<OperationResult>;
  onWorkspaceEvent: (cb: (event: WorkspaceEvent) => void) => () => void;
  readFile: (filePath: string) => Promise<ReadFileResult>;
  writeFile: (payload: WriteFilePayload) => Promise<OperationResult>;
  createFile: (payload: CreateFilePayload) => Promise<OperationResult>;
  createFolder: (payload: CreateFolderPayload) => Promise<OperationResult>;
  renamePath: (payload: RenamePathPayload) => Promise<OperationResult>;
  movePath: (payload: MovePathPayload) => Promise<OperationResult>;
  deletePath: (payload: DeletePathPayload) => Promise<OperationResult>;
  revealInFinder: (targetPath: string) => Promise<OperationResult>;
  searchInFiles: (payload: SearchInFilesPayload) => Promise<SearchInFilesResult>;

  // Terminal PTY
  terminalCreate: (payload: TerminalCreatePayload) => Promise<TerminalCreateResult>;
  terminalWrite: (payload: TerminalWritePayload) => Promise<OperationResult>;
  terminalResize: (payload: TerminalResizePayload) => Promise<OperationResult>;
  terminalDispose: (payload: TerminalDisposePayload) => Promise<OperationResult>;
  onTerminalData: (cb: (event: TerminalDataEvent) => void) => () => void;
  onTerminalExit: (cb: (event: TerminalExitEvent) => void) => () => void;

  // Legacy AI tool
  runTerminalCommand: (payload: RunTerminalPayload) => Promise<RunTerminalResult>;

  // Browser
  analyzeUrlWithPlaywright: (payload: AnalyzeUrlPayload) => Promise<AnalyzeUrlResult>;

  // Secrets
  setSecret: (payload: SecretSetPayload) => Promise<OperationResult>;
  getSecret: (payload: SecretGetPayload) => Promise<SecretGetResult>;
  deleteSecret: (payload: SecretGetPayload) => Promise<OperationResult>;
  hasMasterPassphrase: () => Promise<SecretsHasMasterResult>;
  setMasterPassphrase: (payload: SecretsSetMasterPayload) => Promise<OperationResult>;
  unlockSecrets: (payload: SecretsUnlockPayload) => Promise<OperationResult>;

  // Scaffolders
  scaffoldFullstackProject: (payload: ScaffoldFullstackPayload) => Promise<ScaffoldFullstackResult>;
  exportCanvas: (payload: ExportCanvasPayload) => Promise<ExportCanvasResult>;

  // Plugins
  pluginScan: () => Promise<PluginScanResult>;
  pluginLoadBundle: (id: string) => Promise<PluginBundleResult>;
  pluginInstallFromPath: (payload: PluginInstallPayload) => Promise<PluginInstallResult>;
  pluginInstallFromUrl: (payload: PluginInstallFromUrlPayload) => Promise<PluginInstallResult>;
  pluginUninstall: (payload: PluginUninstallPayload) => Promise<OperationResult>;
  pluginVerify: (payload: PluginVerifyPayload) => Promise<PluginVerifyResult>;
  extHostRunBundle: (payload: ExtHostRunBundlePayload) => Promise<OperationResult>;
  extHostStop: (payload: ExtHostStopPayload) => Promise<OperationResult>;

  // Git
  getGitStatus: (workspacePath: string) => Promise<GitStatusResult>;
  getGitLog: (payload: GitLogPayload) => Promise<GitLogResult>;
  getGitDiff: (payload: GitDiffPayload) => Promise<GitDiffResult>;
  gitStage: (payload: GitStagePayload) => Promise<OperationResult>;
  gitUnstage: (payload: GitStagePayload) => Promise<OperationResult>;
  gitCommit: (payload: GitCommitPayload) => Promise<GitCommitResult>;
  gitPush: (payload: GitPushPayload) => Promise<OperationResult>;
  gitPull: (payload: GitPullPayload) => Promise<OperationResult>;
  gitBranchList: (workspacePath: string) => Promise<GitBranchListResult>;
  gitBranchCreate: (payload: GitBranchCreatePayload) => Promise<OperationResult>;
  gitBranchCheckout: (payload: GitBranchCheckoutPayload) => Promise<OperationResult>;
  gitBlame: (payload: GitBlamePayload) => Promise<GitBlameResult>;

  // LSP
  lspStart: (payload: LspStartPayload) => Promise<LspStartResult>;
  lspStop: (sessionId: string) => Promise<OperationResult>;
  lspSend: (payload: LspMessagePayload) => Promise<OperationResult>;
  onLspMessage: (cb: (msg: LspMessagePayload) => void) => () => void;

  // DAP
  dapLaunch: (payload: DapLaunchPayload) => Promise<DapLaunchResult>;
  dapTerminate: (sessionId: string) => Promise<OperationResult>;
  dapSend: (payload: { sessionId: string; message: unknown }) => Promise<OperationResult>;
  onDapEvent: (cb: (msg: { sessionId: string; message: unknown }) => void) => () => void;

  // Preview
  previewStart: (payload: PreviewStartPayload) => Promise<PreviewStartResult>;
  previewStop: (workspacePath: string) => Promise<OperationResult>;
  previewAttachView: (payload: PreviewAttachViewPayload) => Promise<OperationResult>;
  previewSetBounds: (payload: PreviewSetBoundsPayload) => Promise<OperationResult>;
  previewDetachView: () => Promise<OperationResult>;

  // DB
  dbExecute: (payload: DbExecutePayload) => Promise<OperationResult>;
  dbQuery: <T = unknown>(payload: DbExecutePayload) => Promise<DbQueryResult<T>>;

  // Updates
  updateCheck: () => Promise<OperationResult>;
  updateDownload: () => Promise<OperationResult>;
  updateInstall: () => Promise<OperationResult>;
  onUpdateEvent: (cb: (event: UpdateEvent) => void) => () => void;

  // Telemetry
  telemetryEvent: (payload: TelemetryEventPayload) => Promise<OperationResult>;
};
