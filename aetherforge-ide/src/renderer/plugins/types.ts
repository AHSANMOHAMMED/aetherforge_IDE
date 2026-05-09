import type { PluginManifestRaw } from '../../common/ipc';

// Re-export for convenience
export type { PluginManifestRaw };

// ─── Contribution shapes ──────────────────────────────────────────────────────

export type PluginCommandContribution = {
  id: string;
  title: string;
  keybinding?: string;
};

export type PluginViewContribution = {
  id: string;
  title: string;
  location?: 'main' | 'right';
};

export type PluginLanguageContribution = {
  id: string;
  aliases?: string[];
  extensions?: string[];
};

// ─── Plugin API (injected into plugin bundles) ────────────────────────────────

export type Disposable = () => void;

export type PluginCommandsAPI = {
  register: (id: string, handler: () => void | Promise<void>) => Disposable;
  execute: (id: string) => Promise<void>;
};

export type PluginWorkspaceAPI = {
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  getWorkspacePath: () => string | null;
};

export type PluginViewsAPI = {
  registerView: (id: string, title: string, location?: 'main' | 'right') => Disposable;
};

export type PluginToastAPI = {
  show: (message: string, level?: 'info' | 'success' | 'error') => void;
};

export type PluginCanvasAPI = {
  getNodes: () => PluginCanvasNode[];
  addNode: (node: PluginCanvasNode) => void;
};

export type PluginCanvasNode = {
  id?: string;
  componentType: string;
  label: string;
  x: number;
  y: number;
  props?: Record<string, unknown>;
};

export type PluginAPI = {
  commands: PluginCommandsAPI;
  workspace: PluginWorkspaceAPI;
  views: PluginViewsAPI;
  toast: PluginToastAPI;
  canvas: PluginCanvasAPI;
};

// ─── Registry types ───────────────────────────────────────────────────────────

export type RegisteredCommand = {
  id: string;
  title: string;
  pluginId: string;
  handler: () => void | Promise<void>;
};

export type RegisteredView = {
  id: string;
  title: string;
  pluginId: string;
  location: 'main' | 'right';
};

export type PluginStatus = 'idle' | 'loaded' | 'error';

export type PluginRecord = {
  manifest: PluginManifestRaw;
  installPath: string;
  enabled: boolean;
  status: PluginStatus;
  error?: string;
};
