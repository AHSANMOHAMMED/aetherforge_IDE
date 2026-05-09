import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  IPCChannels,
  type AnalyzeUrlPayload,
  type AnalyzeUrlResult,
  type AppInfo,
  type CreateFilePayload,
  type CreateFolderPayload,
  type DapLaunchPayload,
  type DapLaunchResult,
  type DbExecutePayload,
  type DbQueryResult,
  type DeletePathPayload,
  type ExportCanvasPayload,
  type ExportCanvasResult,
  type FileNode,
  type GitBlamePayload,
  type GitBlameResult,
  type GitBranchCheckoutPayload,
  type GitBranchCreatePayload,
  type GitBranchListResult,
  type GitCommitPayload,
  type GitCommitResult,
  type GitDiffPayload,
  type GitDiffResult,
  type GitLogPayload,
  type GitLogResult,
  type GitPullPayload,
  type GitPushPayload,
  type GitStagePayload,
  type GitStatusResult,
  type LspMessagePayload,
  type LspStartPayload,
  type LspStartResult,
  type MovePathPayload,
  type OpenWorkspaceDialogResult,
  type OperationResult,
  type PingResponse,
  type PluginBundleResult,
  type PluginInstallFromUrlPayload,
  type PluginInstallPayload,
  type PluginInstallResult,
  type PluginScanResult,
  type PluginUninstallPayload,
  type PluginVerifyPayload,
  type PluginVerifyResult,
  type PreviewAttachViewPayload,
  type PreviewSetBoundsPayload,
  type PreviewStartPayload,
  type PreviewStartResult,
  type ReadFileResult,
  type RenamePathPayload,
  type RunTerminalPayload,
  type RunTerminalResult,
  type ScaffoldFullstackPayload,
  type ScaffoldFullstackResult,
  type SearchInFilesPayload,
  type SearchInFilesResult,
  type SecretGetPayload,
  type SecretGetResult,
  type SecretSetPayload,
  type SecretsHasMasterResult,
  type SecretsSetMasterPayload,
  type SecretsUnlockPayload,
  type TelemetryEventPayload,
  type TerminalCreatePayload,
  type TerminalCreateResult,
  type TerminalDataEvent,
  type TerminalDisposePayload,
  type TerminalExitEvent,
  type TerminalResizePayload,
  type TerminalWritePayload,
  type UnwatchWorkspacePayload,
  type UpdateEvent,
  type WatchWorkspacePayload,
  type WorkspaceEvent,
  type WriteFilePayload
} from '../src/common/ipc';

function on<T>(channel: string, cb: (event: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, value: T) => cb(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const electronAPI = {
  // Core
  ping: (): Promise<PingResponse> => ipcRenderer.invoke(IPCChannels.Ping),
  appInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IPCChannels.AppInfo),

  // Workspace
  openWorkspaceDialog: (): Promise<OpenWorkspaceDialogResult> =>
    ipcRenderer.invoke(IPCChannels.OpenWorkspaceDialog),
  readWorkspaceTree: (workspacePath: string): Promise<FileNode[]> =>
    ipcRenderer.invoke(IPCChannels.ReadWorkspaceTree, workspacePath),
  watchWorkspace: (payload: WatchWorkspacePayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.WatchWorkspace, payload),
  unwatchWorkspace: (payload: UnwatchWorkspacePayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.UnwatchWorkspace, payload),
  onWorkspaceEvent: (cb: (event: WorkspaceEvent) => void) => on(IPCChannels.WorkspaceEvent, cb),

  // FS
  readFile: (filePath: string): Promise<ReadFileResult> => ipcRenderer.invoke(IPCChannels.ReadFile, filePath),
  writeFile: (payload: WriteFilePayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.WriteFile, payload),
  createFile: (payload: CreateFilePayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.CreateFile, payload),
  createFolder: (payload: CreateFolderPayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.CreateFolder, payload),
  renamePath: (payload: RenamePathPayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.RenamePath, payload),
  movePath: (payload: MovePathPayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.MovePath, payload),
  deletePath: (payload: DeletePathPayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.DeletePath, payload),
  revealInFinder: (targetPath: string): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.RevealInFinder, targetPath),
  searchInFiles: (payload: SearchInFilesPayload): Promise<SearchInFilesResult> =>
    ipcRenderer.invoke(IPCChannels.SearchInFiles, payload),

  // Terminal PTY
  terminalCreate: (payload: TerminalCreatePayload): Promise<TerminalCreateResult> =>
    ipcRenderer.invoke(IPCChannels.TerminalCreate, payload),
  terminalWrite: (payload: TerminalWritePayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.TerminalWrite, payload),
  terminalResize: (payload: TerminalResizePayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.TerminalResize, payload),
  terminalDispose: (payload: TerminalDisposePayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.TerminalDispose, payload),
  onTerminalData: (cb: (event: TerminalDataEvent) => void) => on(IPCChannels.TerminalData, cb),
  onTerminalExit: (cb: (event: TerminalExitEvent) => void) => on(IPCChannels.TerminalExit, cb),

  // Legacy command runner
  runTerminalCommand: (payload: RunTerminalPayload): Promise<RunTerminalResult> =>
    ipcRenderer.invoke(IPCChannels.RunTerminalCommand, payload),

  // Browser
  analyzeUrlWithPlaywright: (payload: AnalyzeUrlPayload): Promise<AnalyzeUrlResult> =>
    ipcRenderer.invoke(IPCChannels.AnalyzeUrlWithPlaywright, payload),

  // Secrets
  setSecret: (payload: SecretSetPayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.SecretsSet, payload),
  getSecret: (payload: SecretGetPayload): Promise<SecretGetResult> =>
    ipcRenderer.invoke(IPCChannels.SecretsGet, payload),
  deleteSecret: (payload: SecretGetPayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.SecretsDelete, payload),
  hasMasterPassphrase: (): Promise<SecretsHasMasterResult> =>
    ipcRenderer.invoke(IPCChannels.SecretsHasMaster),
  setMasterPassphrase: (payload: SecretsSetMasterPayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.SecretsSetMaster, payload),
  unlockSecrets: (payload: SecretsUnlockPayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.SecretsUnlock, payload),

  // Scaffolders
  scaffoldFullstackProject: (payload: ScaffoldFullstackPayload): Promise<ScaffoldFullstackResult> =>
    ipcRenderer.invoke(IPCChannels.ScaffoldFullstackProject, payload),
  exportCanvas: (payload: ExportCanvasPayload): Promise<ExportCanvasResult> =>
    ipcRenderer.invoke(IPCChannels.ExportCanvas, payload),

  // Plugins
  pluginScan: (): Promise<PluginScanResult> => ipcRenderer.invoke(IPCChannels.PluginScan),
  pluginLoadBundle: (id: string): Promise<PluginBundleResult> =>
    ipcRenderer.invoke(IPCChannels.PluginLoadBundle, id),
  pluginInstallFromPath: (payload: PluginInstallPayload): Promise<PluginInstallResult> =>
    ipcRenderer.invoke(IPCChannels.PluginInstallFromPath, payload),
  pluginInstallFromUrl: (payload: PluginInstallFromUrlPayload): Promise<PluginInstallResult> =>
    ipcRenderer.invoke(IPCChannels.PluginInstallFromUrl, payload),
  pluginUninstall: (payload: PluginUninstallPayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.PluginUninstall, payload),
  pluginVerify: (payload: PluginVerifyPayload): Promise<PluginVerifyResult> =>
    ipcRenderer.invoke(IPCChannels.PluginVerify, payload),

  // Git
  getGitStatus: (workspacePath: string): Promise<GitStatusResult> =>
    ipcRenderer.invoke(IPCChannels.GitGetStatus, workspacePath),
  getGitLog: (payload: GitLogPayload): Promise<GitLogResult> =>
    ipcRenderer.invoke(IPCChannels.GitGetLog, payload),
  getGitDiff: (payload: GitDiffPayload): Promise<GitDiffResult> =>
    ipcRenderer.invoke(IPCChannels.GitGetDiff, payload),
  gitStage: (payload: GitStagePayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.GitStage, payload),
  gitUnstage: (payload: GitStagePayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.GitUnstage, payload),
  gitCommit: (payload: GitCommitPayload): Promise<GitCommitResult> =>
    ipcRenderer.invoke(IPCChannels.GitCommit, payload),
  gitPush: (payload: GitPushPayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.GitPush, payload),
  gitPull: (payload: GitPullPayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.GitPull, payload),
  gitBranchList: (workspacePath: string): Promise<GitBranchListResult> =>
    ipcRenderer.invoke(IPCChannels.GitBranchList, workspacePath),
  gitBranchCreate: (payload: GitBranchCreatePayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.GitBranchCreate, payload),
  gitBranchCheckout: (payload: GitBranchCheckoutPayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.GitBranchCheckout, payload),
  gitBlame: (payload: GitBlamePayload): Promise<GitBlameResult> =>
    ipcRenderer.invoke(IPCChannels.GitBlame, payload),

  // LSP
  lspStart: (payload: LspStartPayload): Promise<LspStartResult> =>
    ipcRenderer.invoke(IPCChannels.LspStart, payload),
  lspStop: (sessionId: string): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.LspStop, sessionId),
  lspSend: (payload: LspMessagePayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.LspNotification, payload),
  onLspMessage: (cb: (msg: LspMessagePayload) => void) => on(IPCChannels.LspMessage, cb),

  // DAP
  dapLaunch: (payload: DapLaunchPayload): Promise<DapLaunchResult> =>
    ipcRenderer.invoke(IPCChannels.DapLaunch, payload),
  dapTerminate: (sessionId: string): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.DapTerminate, sessionId),
  dapSend: (payload: { sessionId: string; message: unknown }): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.DapRequest, payload),
  onDapEvent: (cb: (msg: { sessionId: string; message: unknown }) => void) => on(IPCChannels.DapEvent, cb),

  // Preview
  previewStart: (payload: PreviewStartPayload): Promise<PreviewStartResult> =>
    ipcRenderer.invoke(IPCChannels.PreviewStart, payload),
  previewStop: (workspacePath: string): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.PreviewStop, workspacePath),
  previewAttachView: (payload: PreviewAttachViewPayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.PreviewAttachView, payload),
  previewSetBounds: (payload: PreviewSetBoundsPayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.PreviewSetBounds, payload),
  previewDetachView: (): Promise<OperationResult> => ipcRenderer.invoke(IPCChannels.PreviewDetachView),

  // DB
  dbExecute: (payload: DbExecutePayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.DbExecute, payload),
  dbQuery: <T = unknown>(payload: DbExecutePayload): Promise<DbQueryResult<T>> =>
    ipcRenderer.invoke(IPCChannels.DbQuery, payload),

  // Updates
  updateCheck: (): Promise<OperationResult> => ipcRenderer.invoke(IPCChannels.UpdateCheck),
  updateDownload: (): Promise<OperationResult> => ipcRenderer.invoke(IPCChannels.UpdateDownload),
  updateInstall: (): Promise<OperationResult> => ipcRenderer.invoke(IPCChannels.UpdateInstall),
  onUpdateEvent: (cb: (event: UpdateEvent) => void) => on(IPCChannels.UpdateEvent, cb),

  // Telemetry
  telemetryEvent: (payload: TelemetryEventPayload): Promise<OperationResult> =>
    ipcRenderer.invoke(IPCChannels.TelemetryEvent, payload)
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
