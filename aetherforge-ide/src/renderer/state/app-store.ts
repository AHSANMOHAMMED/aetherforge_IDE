import { create } from 'zustand';
import { useSettingsStore } from '@/renderer/state/settings-store';
import { CANVAS_VIRTUAL_NAME, CANVAS_VIRTUAL_PATH } from '@/renderer/canvas/sync';
import {
  API_OPENAPI_VIRTUAL_NAME,
  API_OPENAPI_VIRTUAL_PATH,
  API_VIRTUAL_NAME,
  API_VIRTUAL_PATH
} from '@/renderer/backend/api/sync';
import {
  DB_PRISMA_VIRTUAL_NAME,
  DB_PRISMA_VIRTUAL_PATH,
  DB_SUPABASE_VIRTUAL_NAME,
  DB_SUPABASE_VIRTUAL_PATH
} from '@/renderer/backend/db/sync';
import type { ElectronAPI, FileNode, GitFileStatusEntry } from '@/common/ipc';
import type { SidebarTab } from '@/renderer/components/sidebar/types';
import { useModalStore } from '@/renderer/state/modal-store';
import { useToastStore } from '@/renderer/state/toast-store';

export type WorkspaceMode =
  | 'code'
  | 'visual'
  | 'split'
  | 'api-visual'
  | 'db-visual'
  | 'export'
  | 'preview'
  | 'settings'
  | 'marketplace';
export type PaletteMode = 'quick-open' | 'command';

export type EditorTab = {
  id: string;
  path: string;
  name: string;
  content: string;
  savedContent: string;
  language: string;
  encoding: 'utf-8';
  isDirty: boolean;
};

type AppState = {
  mode: WorkspaceMode;
  workspacePath: string | null;
  fileTree: FileNode[];
  openTabs: EditorTab[];
  activeTabId: string | null;
  terminalVisible: boolean;
  commandPaletteOpen: boolean;
  commandPaletteMode: PaletteMode;
  sidebarActiveTab: SidebarTab;
  cursor: { line: number; column: number };
  currentBranch: string;
  gitStatusByPath: Record<string, string>;
  setMode: (mode: WorkspaceMode) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  openWorkspaceFolder: () => Promise<void>;
  refreshWorkspaceTree: () => Promise<void>;
  openFile: (filePath: string) => Promise<void>;
  createFile: (directoryPath: string, fileName: string) => Promise<boolean>;
  createFolder: (directoryPath: string, folderName: string) => Promise<boolean>;
  renamePath: (targetPath: string, newName: string) => Promise<boolean>;
  deletePath: (targetPath: string) => Promise<boolean>;
  revealInFinder: (targetPath: string) => Promise<boolean>;
  saveTab: (tabId: string) => Promise<boolean>;
  saveActiveTab: () => Promise<boolean>;
  closeTab: (tabId: string) => Promise<void>;
  closeOtherTabs: (tabId: string) => Promise<void>;
  closeSavedTabs: () => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  setActiveTab: (tabId: string) => void;
  updateActiveTabContent: (content: string) => void;
  setCursor: (line: number, column: number) => void;
  toggleAutoSave: () => void;
  toggleTerminal: () => void;
  setCommandPalette: (open: boolean, mode?: PaletteMode) => void;
  refreshGitStatus: () => Promise<void>;
  ensureCanvasTab: () => void;
  ensureApiTabs: () => void;
  ensureDbTabs: () => void;
  upsertVirtualTabContent: (path: string, name: string, content: string) => void;
  upsertOpenTabContent: (path: string, content: string) => void;
};

function detectLanguageFromPath(filePath: string): string {
  const extension = getExtension(filePath).toLowerCase();
  const languageByExtension: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.json': 'json',
    '.css': 'css',
    '.html': 'html',
    '.md': 'markdown',
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.sh': 'shell',
    '.py': 'python',
    '.rs': 'rust',
    '.go': 'go',
    '.sql': 'sql',
    '.prisma': 'plaintext'
  };
  return languageByExtension[extension] ?? 'plaintext';
}

function normalizeSeparators(value: string): string {
  return value.replace(/\\/g, '/');
}

function getBaseName(filePath: string): string {
  const normalized = normalizeSeparators(filePath);
  const parts = normalized.split('/');
  return parts[parts.length - 1] ?? filePath;
}

function getDirectoryName(filePath: string): string {
  const normalized = normalizeSeparators(filePath);
  const parts = normalized.split('/');
  parts.pop();
  return parts.join('/') || '/';
}

function getExtension(filePath: string): string {
  const base = getBaseName(filePath);
  const dotIndex = base.lastIndexOf('.');
  return dotIndex > -1 ? base.slice(dotIndex) : '';
}

function joinPath(directoryPath: string, name: string): string {
  const normalizedDirectory = normalizeSeparators(directoryPath).replace(/\/$/, '');
  return `${normalizedDirectory}/${name}`;
}

function notify(level: 'success' | 'error' | 'info', title: string, description?: string): void {
  useToastStore.getState().pushToast({
    level,
    title,
    description,
    durationMs: level === 'error' ? 3600 : 2400
  });
}

function flattenFiles(nodes: FileNode[]): string[] {
  const files: string[] = [];
  for (const node of nodes) {
    if (node.type === 'file') {
      files.push(node.path);
      continue;
    }
    if (node.children) {
      files.push(...flattenFiles(node.children));
    }
  }
  return files;
}

function buildTab(filePath: string, content: string): EditorTab {
  return {
    id: filePath,
    path: filePath,
    name: getBaseName(filePath),
    content,
    savedContent: content,
    language: detectLanguageFromPath(filePath),
    encoding: 'utf-8',
    isDirty: false
  };
}

function mapGitStatus(entries: GitFileStatusEntry[]): Record<string, string> {
  return entries.reduce<Record<string, string>>((acc, entry) => {
    acc[normalizeSeparators(entry.path)] = entry.code;
    return acc;
  }, {});
}

function getElectronAPI(): ElectronAPI | null {
  const api = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
  return api ?? null;
}

export const useAppStore = create<AppState>((set, get) => ({
  mode: 'code',
  workspacePath: null,
  fileTree: [],
  openTabs: [],
  activeTabId: null,
  terminalVisible: true,
  commandPaletteOpen: false,
  commandPaletteMode: 'quick-open',
  sidebarActiveTab: 'explorer',
  cursor: { line: 1, column: 1 },
  currentBranch: 'main',
  gitStatusByPath: {},

  setSidebarTab: (tab) => set({ sidebarActiveTab: tab }),

  setMode: (mode) => {
    if (mode === 'visual') {
      get().ensureCanvasTab();
      set({ mode, activeTabId: CANVAS_VIRTUAL_PATH });
      return;
    }

    if (mode === 'split') {
      get().ensureCanvasTab();
      const activeTabId = get().activeTabId ?? CANVAS_VIRTUAL_PATH;
      set({ mode, activeTabId });
      return;
    }

    if (mode === 'api-visual') {
      get().ensureApiTabs();
      set({ mode, activeTabId: API_VIRTUAL_PATH });
      return;
    }

    if (mode === 'db-visual') {
      get().ensureDbTabs();
      set({ mode, activeTabId: DB_PRISMA_VIRTUAL_PATH });
      return;
    }

    set({ mode });
  },

  ensureCanvasTab: () => {
    set((state) => {
      const existing = state.openTabs.find((tab) => tab.path === CANVAS_VIRTUAL_PATH);
      if (existing) {
        return state;
      }

      return {
        openTabs: [
          ...state.openTabs,
          {
            id: CANVAS_VIRTUAL_PATH,
            path: CANVAS_VIRTUAL_PATH,
            name: CANVAS_VIRTUAL_NAME,
            content: '',
            savedContent: '',
            language: 'typescript',
            encoding: 'utf-8',
            isDirty: false
          }
        ]
      };
    });
  },

  ensureApiTabs: () => {
    set((state) => {
      const existingPaths = new Set(state.openTabs.map((tab) => tab.path));
      const additions: EditorTab[] = [];

      if (!existingPaths.has(API_VIRTUAL_PATH)) {
        additions.push({
          id: API_VIRTUAL_PATH,
          path: API_VIRTUAL_PATH,
          name: API_VIRTUAL_NAME,
          content: '',
          savedContent: '',
          language: 'typescript',
          encoding: 'utf-8',
          isDirty: false
        });
      }

      if (!existingPaths.has(API_OPENAPI_VIRTUAL_PATH)) {
        additions.push({
          id: API_OPENAPI_VIRTUAL_PATH,
          path: API_OPENAPI_VIRTUAL_PATH,
          name: API_OPENAPI_VIRTUAL_NAME,
          content: '',
          savedContent: '',
          language: 'json',
          encoding: 'utf-8',
          isDirty: false
        });
      }

      if (additions.length === 0) {
        return state;
      }

      return {
        openTabs: [...state.openTabs, ...additions]
      };
    });
  },

  ensureDbTabs: () => {
    set((state) => {
      const existingPaths = new Set(state.openTabs.map((tab) => tab.path));
      const additions: EditorTab[] = [];

      if (!existingPaths.has(DB_PRISMA_VIRTUAL_PATH)) {
        additions.push({
          id: DB_PRISMA_VIRTUAL_PATH,
          path: DB_PRISMA_VIRTUAL_PATH,
          name: DB_PRISMA_VIRTUAL_NAME,
          content: '',
          savedContent: '',
          language: 'plaintext',
          encoding: 'utf-8',
          isDirty: false
        });
      }

      if (!existingPaths.has(DB_SUPABASE_VIRTUAL_PATH)) {
        additions.push({
          id: DB_SUPABASE_VIRTUAL_PATH,
          path: DB_SUPABASE_VIRTUAL_PATH,
          name: DB_SUPABASE_VIRTUAL_NAME,
          content: '',
          savedContent: '',
          language: 'sql',
          encoding: 'utf-8',
          isDirty: false
        });
      }

      if (additions.length === 0) {
        return state;
      }

      return {
        openTabs: [...state.openTabs, ...additions]
      };
    });
  },

  upsertVirtualTabContent: (path, name, content) => {
    set((state) => {
      const existing = state.openTabs.find((tab) => tab.path === path);
      if (!existing) {
        return {
          openTabs: [
            ...state.openTabs,
            {
              id: path,
              path,
              name,
              content,
              savedContent: content,
              language: 'typescript',
              encoding: 'utf-8',
              isDirty: false
            }
          ]
        };
      }

      if (existing.content === content) {
        return state;
      }

      return {
        openTabs: state.openTabs.map((tab) =>
          tab.path === path
            ? {
                ...tab,
                name,
                content,
                savedContent: content,
                isDirty: false
              }
            : tab
        )
      };
    });
  },

  upsertOpenTabContent: (path, content) => {
    set((state) => {
      const existing = state.openTabs.find((tab) => tab.path === path);
      if (!existing) {
        return {
          openTabs: [
            ...state.openTabs,
            {
              id: path,
              path,
              name: getBaseName(path),
              content,
              savedContent: content,
              language: detectLanguageFromPath(path),
              encoding: 'utf-8',
              isDirty: false
            }
          ]
        };
      }

      return {
        openTabs: state.openTabs.map((tab) =>
          tab.path === path
            ? {
                ...tab,
                content,
                savedContent: content,
                isDirty: false
              }
            : tab
        )
      };
    });
  },

  openWorkspaceFolder: async () => {
    const api = getElectronAPI();
    if (!api) {
      notify('error', 'Electron runtime unavailable', 'Open this project in AetherForge desktop mode.');
      return;
    }

    const response = await api.openWorkspaceDialog();
    if (response.canceled || !response.path) {
      notify('info', 'Open workspace canceled');
      return;
    }

    try {
      const [tree, gitStatus] = await Promise.all([
        api.readWorkspaceTree(response.path),
        api.getGitStatus(response.path)
      ]);
      const flatFiles = flattenFiles(tree);
      set({
        workspacePath: response.path,
        fileTree: tree,
        openTabs: [],
        activeTabId: null,
        cursor: { line: 1, column: 1 },
        currentBranch: gitStatus.branch || 'main',
        gitStatusByPath: mapGitStatus(gitStatus.entries)
      });

      if (flatFiles.length > 0) {
        await get().openFile(flatFiles[0]);
      }
      notify('success', 'Workspace opened', response.path);
    } catch (error) {
      notify('error', 'Failed to open workspace', error instanceof Error ? error.message : 'Unknown error');
    }
  },

  refreshWorkspaceTree: async () => {
    const workspacePath = get().workspacePath;
    if (!workspacePath) {
      return;
    }
    const api = getElectronAPI();
    if (!api) {
      notify('error', 'Electron runtime unavailable', 'Refresh requires desktop runtime.');
      return;
    }

    try {
      const [tree, gitStatus] = await Promise.all([
        api.readWorkspaceTree(workspacePath),
        api.getGitStatus(workspacePath)
      ]);
      set({
        fileTree: tree,
        currentBranch: gitStatus.branch || get().currentBranch,
        gitStatusByPath: mapGitStatus(gitStatus.entries)
      });
    } catch (error) {
      notify('error', 'Failed to refresh explorer', error instanceof Error ? error.message : 'Unknown error');
    }
  },

  refreshGitStatus: async () => {
    const workspacePath = get().workspacePath;
    if (!workspacePath) {
      set({ currentBranch: 'main', gitStatusByPath: {} });
      return;
    }

    const api = getElectronAPI();
    if (!api) {
      set({ currentBranch: 'no-runtime', gitStatusByPath: {} });
      return;
    }

    try {
      const gitStatus = await api.getGitStatus(workspacePath);
      set({
        currentBranch: gitStatus.branch || get().currentBranch,
        gitStatusByPath: mapGitStatus(gitStatus.entries)
      });
    } catch {
      set({ currentBranch: 'no-git', gitStatusByPath: {} });
    }
  },

  openFile: async (filePath) => {
    const existingTab = get().openTabs.find((tab) => tab.path === filePath);
    if (existingTab) {
      set({ activeTabId: existingTab.id });
      return;
    }

    const api = getElectronAPI();
    if (!api) {
      notify('error', 'Electron runtime unavailable', 'Opening files requires desktop runtime.');
      return;
    }

    try {
      const response = await api.readFile(filePath);
      const tab = buildTab(filePath, response.content);

      set((state) => ({
        openTabs: [...state.openTabs, tab],
        activeTabId: tab.id,
        cursor: { line: 1, column: 1 }
      }));
    } catch (error) {
      notify('error', 'Failed to open file', error instanceof Error ? error.message : filePath);
    }
  },

  createFile: async (directoryPath, fileName) => {
    const api = getElectronAPI();
    if (!api) {
      notify('error', 'Electron runtime unavailable', 'Creating files requires desktop runtime.');
      return false;
    }

    const result = await api.createFile({ directoryPath, fileName });
    if (!result.ok) {
      notify('error', 'Failed to create file', result.error);
      return false;
    }
    await get().refreshWorkspaceTree();
    await get().openFile(joinPath(directoryPath, fileName));
    notify('success', 'File created', fileName);
    return true;
  },

  createFolder: async (directoryPath, folderName) => {
    const api = getElectronAPI();
    if (!api) {
      notify('error', 'Electron runtime unavailable', 'Creating folders requires desktop runtime.');
      return false;
    }

    const result = await api.createFolder({ directoryPath, folderName });
    if (!result.ok) {
      notify('error', 'Failed to create folder', result.error);
      return false;
    }
    await get().refreshWorkspaceTree();
    notify('success', 'Folder created', folderName);
    return true;
  },

  renamePath: async (targetPath, newName) => {
    const api = getElectronAPI();
    if (!api) {
      notify('error', 'Electron runtime unavailable', 'Renaming requires desktop runtime.');
      return false;
    }

    const result = await api.renamePath({ targetPath, newName });
    if (!result.ok) {
      notify('error', 'Rename failed', result.error);
      return false;
    }

    await get().refreshWorkspaceTree();
    const oldPath = targetPath;
    const newPath = joinPath(getDirectoryName(targetPath), newName);

    set((state) => {
      const updatedTabs = state.openTabs.map((tab) => {
        if (tab.path === oldPath || tab.path.startsWith(`${normalizeSeparators(oldPath)}/`)) {
          const replacedPath = tab.path.replace(oldPath, newPath);
          return {
            ...tab,
            id: replacedPath,
            path: replacedPath,
            name: getBaseName(replacedPath),
            language: detectLanguageFromPath(replacedPath)
          };
        }
        return tab;
      });

      const activeTabWasRenamed =
        state.activeTabId === oldPath ||
        (state.activeTabId ? state.activeTabId.startsWith(`${normalizeSeparators(oldPath)}/`) : false);
      const renamedActiveTabId =
        activeTabWasRenamed && state.activeTabId ? state.activeTabId.replace(oldPath, newPath) : null;
      const activeExists = renamedActiveTabId
        ? updatedTabs.some((tab) => tab.id === renamedActiveTabId)
        : state.activeTabId
          ? updatedTabs.some((tab) => tab.id === state.activeTabId)
          : false;
      const fallbackActiveId = activeExists
        ? (renamedActiveTabId ?? state.activeTabId)
        : (updatedTabs[0]?.id ?? null);

      return {
        openTabs: updatedTabs,
        activeTabId: fallbackActiveId
      };
    });

    notify('success', 'Renamed', newName);

    return true;
  },

  deletePath: async (targetPath) => {
    const api = getElectronAPI();
    if (!api) {
      notify('error', 'Electron runtime unavailable', 'Deleting requires desktop runtime.');
      return false;
    }

    const result = await api.deletePath({ targetPath });
    if (!result.ok) {
      notify('error', 'Delete failed', result.error);
      return false;
    }

    await get().refreshWorkspaceTree();

    set((state) => {
      const remainingTabs = state.openTabs.filter(
        (tab) => tab.path !== targetPath && !tab.path.startsWith(`${normalizeSeparators(targetPath)}/`)
      );
      const stillActive = state.activeTabId
        ? remainingTabs.some((tab) => tab.id === state.activeTabId)
        : false;
      return {
        openTabs: remainingTabs,
        activeTabId: stillActive ? state.activeTabId : (remainingTabs[0]?.id ?? null)
      };
    });

    notify('success', 'Deleted', getBaseName(targetPath));

    return true;
  },

  revealInFinder: async (targetPath) => {
    const api = getElectronAPI();
    if (!api) {
      notify('error', 'Electron runtime unavailable', 'Reveal in Finder requires desktop runtime.');
      return false;
    }

    const result = await api.revealInFinder(targetPath);
    if (!result.ok) {
      notify('error', 'Unable to reveal in Finder', result.error);
      return false;
    }
    notify('info', 'Revealed in Finder', getBaseName(targetPath));
    return result.ok;
  },

  saveTab: async (tabId) => {
    const targetTab = get().openTabs.find((tab) => tab.id === tabId);
    if (!targetTab) {
      return false;
    }

    if (targetTab.path.startsWith('virtual://')) {
      notify('info', 'Virtual file saved in memory', targetTab.name);
      return true;
    }

    const api = getElectronAPI();
    if (!api) {
      notify('error', 'Electron runtime unavailable', 'Saving files requires desktop runtime.');
      return false;
    }

    let content = targetTab.content;
    const settings = useSettingsStore.getState();
    if (settings.formatOnSave || settings.trimTrailingWhitespace || settings.insertFinalNewline) {
      try {
        const { formatBuffer } = await import('@/renderer/editor/format-on-save');
        content = await formatBuffer(targetTab.language, content, {
          usePrettier: settings.formatOnSave,
          tabWidth: settings.tabSize,
          trimTrailingWhitespace: settings.trimTrailingWhitespace,
          insertFinalNewline: settings.insertFinalNewline
        });
      } catch {
        // Formatter failure should never block save
      }
    }

    const result = await api.writeFile({ path: targetTab.path, content });
    if (!result.ok) {
      notify('error', 'Save failed', result.error);
      return false;
    }

    set((state) => ({
      openTabs: state.openTabs.map((tab) =>
        tab.id === tabId
          ? {
              ...tab,
              content,
              savedContent: content,
              isDirty: false
            }
          : tab
      )
    }));
    await get().refreshGitStatus();
    notify('success', 'Saved', targetTab.name);
    return true;
  },

  saveActiveTab: async () => {
    const activeTabId = get().activeTabId;
    if (!activeTabId) {
      return false;
    }
    return get().saveTab(activeTabId);
  },

  closeTab: async (tabId) => {
    const currentState = get();
    const index = currentState.openTabs.findIndex((tab) => tab.id === tabId);
    if (index < 0) {
      return;
    }

    const tab = currentState.openTabs[index];
    if (tab.isDirty) {
      const confirmed = await useModalStore.getState().requestConfirm({
        title: `Close ${tab.name}?`,
        description: 'This tab has unsaved changes.',
        confirmLabel: 'Close Anyway',
        destructive: true
      });
      if (!confirmed) {
        return;
      }
    }

    set((state) => {
      const updatedIndex = state.openTabs.findIndex((candidate) => candidate.id === tabId);
      if (updatedIndex < 0) {
        return state;
      }

      const remainingTabs = state.openTabs.filter((candidate) => candidate.id !== tabId);
      const nextActiveId =
        state.activeTabId === tabId
          ? (remainingTabs[updatedIndex]?.id ?? remainingTabs[updatedIndex - 1]?.id ?? null)
          : state.activeTabId;

      return {
        openTabs: remainingTabs,
        activeTabId: nextActiveId
      };
    });
  },

  closeOtherTabs: async (tabId) => {
    const state = get();
    const keepTab = state.openTabs.find((tab) => tab.id === tabId);
    if (!keepTab) {
      return;
    }

    const dirtyOtherTabs = state.openTabs.filter((tab) => tab.id !== tabId && tab.isDirty);
    if (dirtyOtherTabs.length > 0) {
      const confirmed = await useModalStore.getState().requestConfirm({
        title: 'Close other tabs?',
        description: 'Some tabs have unsaved changes.',
        confirmLabel: 'Close Others',
        destructive: true
      });
      if (!confirmed) {
        return;
      }
    }

    set({
      openTabs: [keepTab],
      activeTabId: keepTab.id
    });
  },

  closeSavedTabs: () => {
    set((state) => {
      const keptTabs = state.openTabs.filter((tab) => tab.isDirty);
      const activeStillOpen = state.activeTabId
        ? keptTabs.some((tab) => tab.id === state.activeTabId)
        : false;
      return {
        openTabs: keptTabs,
        activeTabId: activeStillOpen ? state.activeTabId : (keptTabs[0]?.id ?? null)
      };
    });
  },

  reorderTabs: (fromIndex, toIndex) => {
    if (fromIndex === toIndex) {
      return;
    }

    set((state) => {
      const tabs = [...state.openTabs];
      const [moved] = tabs.splice(fromIndex, 1);
      if (!moved) {
        return state;
      }
      tabs.splice(toIndex, 0, moved);
      return { openTabs: tabs };
    });
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  updateActiveTabContent: (content) => {
    const activeTabId = get().activeTabId;
    if (!activeTabId) {
      return;
    }

    let shouldAutoSave = false;
    set((state) => {
      const updatedTabs = state.openTabs.map((tab) => {
        if (tab.id !== activeTabId) {
          return tab;
        }

        const isDirty = content !== tab.savedContent;
        const autoSaveEnabled = useSettingsStore.getState().autoSaveEnabled;
        shouldAutoSave = autoSaveEnabled && isDirty;
        return {
          ...tab,
          content,
          isDirty
        };
      });

      return { openTabs: updatedTabs };
    });

    if (shouldAutoSave) {
      void get().saveTab(activeTabId);
    }
  },

  setCursor: (line, column) => set({ cursor: { line, column } }),

  toggleAutoSave: () => {
    const settings = useSettingsStore.getState();
    settings.setAutoSaveEnabled(!settings.autoSaveEnabled);
  },

  toggleTerminal: () => set((state) => ({ terminalVisible: !state.terminalVisible })),

  setCommandPalette: (open, mode) =>
    set((state) => ({
      commandPaletteOpen: open,
      commandPaletteMode: mode ?? state.commandPaletteMode
    }))
}));
