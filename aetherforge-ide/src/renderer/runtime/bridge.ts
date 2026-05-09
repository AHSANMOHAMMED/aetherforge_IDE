export type BridgeDiagnostics = {
  bridgeAvailable: boolean;
  pingAvailable: boolean;
  terminalAvailable: boolean;
  ptyAvailable: boolean;
  watcherAvailable: boolean;
  searchAvailable: boolean;
  scaffoldAvailable: boolean;
  exportAvailable: boolean;
  pluginAvailable: boolean;
  gitAvailable: boolean;
  lspAvailable: boolean;
  dapAvailable: boolean;
  previewAvailable: boolean;
  updateAvailable: boolean;
  dbAvailable: boolean;
};

export function getBridgeDiagnostics(): BridgeDiagnostics {
  const api = window.electronAPI;
  return {
    bridgeAvailable: Boolean(api),
    pingAvailable: Boolean(api?.ping),
    terminalAvailable: Boolean(api?.runTerminalCommand),
    ptyAvailable: Boolean(api?.terminalCreate),
    watcherAvailable: Boolean(api?.watchWorkspace),
    searchAvailable: Boolean(api?.searchInFiles),
    scaffoldAvailable: Boolean(api?.scaffoldFullstackProject),
    exportAvailable: Boolean(api?.exportCanvas),
    pluginAvailable: Boolean(api?.pluginScan),
    gitAvailable: Boolean(api?.gitCommit),
    lspAvailable: Boolean(api?.lspStart),
    dapAvailable: Boolean(api?.dapLaunch),
    previewAvailable: Boolean(api?.previewStart),
    updateAvailable: Boolean(api?.updateCheck),
    dbAvailable: Boolean(api?.dbExecute)
  };
}

export function hasBridgeCapability(capability: keyof Omit<BridgeDiagnostics, 'bridgeAvailable'>): boolean {
  return getBridgeDiagnostics()[capability];
}
