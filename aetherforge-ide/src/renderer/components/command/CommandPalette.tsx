import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useAppStore } from '@/renderer/state/app-store';
import { useCanvasStore } from '@/renderer/canvas/store';
import type { FileNode } from '@/common/ipc';
import { useModalStore } from '@/renderer/state/modal-store';
import { validateFileSystemName } from '@/renderer/lib/validators';
import { usePluginRegistry } from '@/renderer/plugins/registry';

type PaletteCommand = {
  id: string;
  label: string;
  action: () => void | Promise<void>;
  hint?: string;
};

type PaletteGroup = {
  title: string;
  items: PaletteCommand[];
};

type RenderItem = {
  groupTitle: string;
  item: PaletteCommand;
  index: number;
};

type RecentUsage = Record<string, { count: number; lastUsed: number }>;

const RECENT_USAGE_KEY = 'aetherforge.commandPalette.recentUsage';

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

function relativePath(filePath: string, workspacePath: string | null): string {
  if (!workspacePath) {
    return filePath;
  }
  const workspaceNormalized = workspacePath.replace(/\\/g, '/');
  const fileNormalized = filePath.replace(/\\/g, '/');
  return fileNormalized.startsWith(workspaceNormalized)
    ? fileNormalized.slice(workspaceNormalized.length + 1)
    : filePath;
}

function fuzzyScore(candidate: string, query: string): number | null {
  const normalizedCandidate = candidate.toLowerCase();
  const normalizedQuery = query.toLowerCase();

  if (!normalizedQuery) {
    return 0;
  }

  let score = 0;
  let queryIndex = 0;
  let streak = 0;

  for (let i = 0; i < normalizedCandidate.length; i += 1) {
    if (normalizedCandidate[i] !== normalizedQuery[queryIndex]) {
      streak = 0;
      continue;
    }

    queryIndex += 1;
    streak += 1;

    score += 8;
    score += streak * 3;

    const isStart =
      i === 0 ||
      normalizedCandidate[i - 1] === '/' ||
      normalizedCandidate[i - 1] === '-' ||
      normalizedCandidate[i - 1] === '_';
    if (isStart) {
      score += 5;
    }

    if (queryIndex === normalizedQuery.length) {
      break;
    }
  }

  if (queryIndex !== normalizedQuery.length) {
    return null;
  }

  score += Math.max(0, 20 - candidate.length * 0.2);
  return score;
}

function loadRecentUsage(): RecentUsage {
  try {
    const raw = localStorage.getItem(RECENT_USAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as RecentUsage;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function persistRecentUsage(usage: RecentUsage): void {
  try {
    localStorage.setItem(RECENT_USAGE_KEY, JSON.stringify(usage));
  } catch {
    // Ignore localStorage failures and keep palette functional.
  }
}

function recentScore(usage: RecentUsage, key: string): number {
  const entry = usage[key];
  if (!entry) {
    return 0;
  }

  const ageMs = Date.now() - entry.lastUsed;
  const recencyBonus = Math.max(0, 24 - ageMs / (1000 * 60 * 60));
  return entry.count * 5 + recencyBonus;
}

export function CommandPalette(): ReactElement | null {
  const isOpen = useAppStore((state) => state.commandPaletteOpen);
  const mode = useAppStore((state) => state.commandPaletteMode);
  const workspacePath = useAppStore((state) => state.workspacePath);
  const fileTree = useAppStore((state) => state.fileTree);
  const setPalette = useAppStore((state) => state.setCommandPalette);
  const openFile = useAppStore((state) => state.openFile);
  const openWorkspace = useAppStore((state) => state.openWorkspaceFolder);
  const createFile = useAppStore((state) => state.createFile);
  const createFolder = useAppStore((state) => state.createFolder);
  const saveActive = useAppStore((state) => state.saveActiveTab);
  const toggleAutoSave = useAppStore((state) => state.toggleAutoSave);
  const toggleTerminal = useAppStore((state) => state.toggleTerminal);
  const requestInput = useModalStore((state) => state.requestInput);
  const pluginCommands = usePluginRegistry((state) => state.commands);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentUsage, setRecentUsage] = useState<RecentUsage>(() => loadRecentUsage());
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  const runItem = async (item: PaletteCommand): Promise<void> => {
    await item.action();
    setRecentUsage((previous) => {
      const now = Date.now();
      const current = previous[item.id];
      const next: RecentUsage = {
        ...previous,
        [item.id]: {
          count: (current?.count ?? 0) + 1,
          lastUsed: now
        }
      };
      persistRecentUsage(next);
      return next;
    });
  };

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const quickOpenItems = useMemo<PaletteCommand[]>(() => {
    const files = flattenFiles(fileTree);
    const normalizedQuery = query.trim().toLowerCase();
    const scored = files
      .map((filePath) => {
        const label = relativePath(filePath, workspacePath);
        const score = fuzzyScore(label, normalizedQuery);
        const scoreWithRecent = score === null ? null : score + recentScore(recentUsage, filePath);
        return { filePath, label, score: scoreWithRecent };
      })
      .filter((item) => item.score !== null)
      .sort((a, b) => {
        const scoreDelta = (b.score ?? 0) - (a.score ?? 0);
        if (scoreDelta !== 0) {
          return scoreDelta;
        }
        return a.label.localeCompare(b.label);
      });

    return scored.slice(0, 100).map((item) => ({
      id: item.filePath,
      label: item.label,
      action: async () => {
        await openFile(item.filePath);
      }
    }));
  }, [fileTree, openFile, query, recentUsage, workspacePath]);

  const commandItems = useMemo<PaletteCommand[]>(() => {
    const commands: PaletteCommand[] = [
      {
        id: 'open-folder',
        label: 'Open Folder',
        hint: 'Cmd/Ctrl+O',
        action: async () => {
          await openWorkspace();
        }
      },
      {
        id: 'new-file',
        label: 'New File',
        action: async () => {
          if (!workspacePath) {
            return;
          }
          const fileName = await requestInput({
            title: 'Create New File',
            description: 'Enter file name',
            placeholder: 'example.ts',
            confirmLabel: 'Create',
            validate: validateFileSystemName
          });
          if (!fileName) {
            return;
          }
          await createFile(workspacePath, fileName);
        }
      },
      {
        id: 'new-folder',
        label: 'New Folder',
        action: async () => {
          if (!workspacePath) {
            return;
          }
          const folderName = await requestInput({
            title: 'Create New Folder',
            description: 'Enter folder name',
            placeholder: 'new-folder',
            confirmLabel: 'Create',
            validate: validateFileSystemName
          });
          if (!folderName) {
            return;
          }
          await createFolder(workspacePath, folderName);
        }
      },
      {
        id: 'save-active-file',
        label: 'Save Active File',
        hint: 'Cmd/Ctrl+S',
        action: async () => {
          await saveActive();
        }
      },
      {
        id: 'toggle-auto-save',
        label: 'Toggle Auto Save',
        action: () => toggleAutoSave()
      },
      {
        id: 'toggle-terminal',
        label: 'Toggle Terminal',
        hint: 'Cmd/Ctrl+J',
        action: () => toggleTerminal()
      },
      {
        id: 'open-visual-canvas',
        label: 'Open Visual Canvas',
        action: () => {
          useAppStore.getState().ensureCanvasTab();
          useAppStore.getState().setMode('visual');
        }
      },
      {
        id: 'open-runtime-preview',
        label: 'Open Runtime Preview',
        action: () => {
          useAppStore.getState().setMode('preview');
        }
      },
      {
        id: 'canvas-embedded-preview-on',
        label: 'Canvas: Show embedded live preview',
        action: () => {
          useCanvasStore.getState().setPreviewMode(true);
        }
      },
      {
        id: 'canvas-embedded-preview-off',
        label: 'Canvas: Hide embedded live preview',
        action: () => {
          useCanvasStore.getState().setPreviewMode(false);
        }
      }
    ];

    // Append plugin-registered commands
    for (const cmd of pluginCommands) {
      commands.push({
        id: `plugin:${cmd.id}`,
        label: cmd.title,
        hint: '[plugin]',
        action: async () => {
          await Promise.resolve(cmd.handler());
        }
      });
    }

    const normalizedQuery = query.trim().toLowerCase();
    return commands
      .map((command) => {
        const base = normalizedQuery ? fuzzyScore(command.label, normalizedQuery) : 0;
        if (base === null) {
          return null;
        }
        const score = base + recentScore(recentUsage, command.id);
        return { command, score };
      })
      .filter((entry): entry is { command: PaletteCommand; score: number } => Boolean(entry))
      .sort((a, b) => {
        const delta = b.score - a.score;
        if (delta !== 0) {
          return delta;
        }
        return a.command.label.localeCompare(b.command.label);
      })
      .map((entry) => entry.command);
  }, [
    createFile,
    createFolder,
    openWorkspace,
    pluginCommands,
    query,
    recentUsage,
    requestInput,
    saveActive,
    toggleAutoSave,
    toggleTerminal,
    workspacePath
  ]);

  const groups = useMemo<PaletteGroup[]>(() => {
    if (mode === 'quick-open') {
      if (quickOpenItems.length === 0) {
        return [];
      }
      return [{ title: 'Files', items: quickOpenItems }];
    }

    const workspaceGroup = commandItems.filter(
      (item) => item.id === 'open-folder' || item.id === 'new-file' || item.id === 'new-folder'
    );
    const fileGroup = commandItems.filter((item) => item.id === 'save-active-file');
    const viewGroup = commandItems.filter(
      (item) =>
        item.id === 'toggle-auto-save' ||
        item.id === 'toggle-terminal' ||
        item.id === 'open-visual-canvas' ||
        item.id === 'open-runtime-preview' ||
        item.id === 'canvas-embedded-preview-on' ||
        item.id === 'canvas-embedded-preview-off'
    );
    const pluginGroup = commandItems.filter((item) => item.id.startsWith('plugin:'));

    return [
      { title: 'Workspace', items: workspaceGroup },
      { title: 'File', items: fileGroup },
      { title: 'View', items: viewGroup },
      { title: 'Extensions', items: pluginGroup }
    ].filter((group) => group.items.length > 0);
  }, [commandItems, mode, quickOpenItems]);

  const renderItems = useMemo<RenderItem[]>(() => {
    let index = 0;
    const list: RenderItem[] = [];
    for (const group of groups) {
      for (const item of group.items) {
        list.push({ groupTitle: group.title, item, index });
        index += 1;
      }
    }
    return list;
  }, [groups]);

  const selectableItems = useMemo(() => renderItems.map((entry) => entry.item), [renderItems]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, mode]);

  useEffect(() => {
    if (selectableItems.length === 0) {
      setSelectedIndex(0);
      return;
    }

    if (selectedIndex > selectableItems.length - 1) {
      setSelectedIndex(selectableItems.length - 1);
    }
  }, [selectableItems, selectedIndex]);

  useEffect(() => {
    if (!isOpen || selectableItems.length === 0) {
      return;
    }

    const listContainer = listContainerRef.current;
    if (!listContainer) {
      return;
    }

    const selectedElement = listContainer.querySelector<HTMLElement>(
      `[data-palette-index="${selectedIndex}"]`
    );
    selectedElement?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, selectableItems.length, selectedIndex]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center bg-black/50 pt-20 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-[#0a0f1d] shadow-2xl">
        <div className="border-b border-white/10 px-4 py-3">
          <p className="text-muted-foreground mb-2 text-xs uppercase tracking-wide">
            {mode === 'quick-open' ? 'Quick Open' : 'Command Palette'}
          </p>
          <input
            autoFocus
            className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none ring-cyan-400/40 focus:ring"
            value={query}
            placeholder={mode === 'quick-open' ? 'Type a file name...' : 'Type a command...'}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={async (event) => {
              if (event.key === 'Escape') {
                setPalette(false);
              }

              if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (selectableItems.length > 0) {
                  setSelectedIndex((current) => (current + 1) % selectableItems.length);
                }
                return;
              }

              if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (selectableItems.length > 0) {
                  setSelectedIndex(
                    (current) => (current - 1 + selectableItems.length) % selectableItems.length
                  );
                }
                return;
              }

              if (event.key === 'Enter' && selectableItems.length > 0) {
                const selected = selectableItems[selectedIndex];
                if (!selected) {
                  return;
                }
                await runItem(selected);
                setPalette(false);
              }
            }}
          />
        </div>

        <div ref={listContainerRef} className="max-h-[380px] overflow-y-auto p-2">
          {selectableItems.length === 0 ? (
            <p className="text-muted-foreground px-2 py-6 text-sm">No results</p>
          ) : (
            groups.map((group) => {
              const entries = renderItems.filter((entry) => entry.groupTitle === group.title);
              return (
                <div key={group.title} className="mb-2 last:mb-0">
                  <p className="text-muted-foreground px-2 py-1 text-[11px] uppercase tracking-wide">
                    {group.title}
                  </p>
                  <div>
                    {entries.map((entry) => (
                      <button
                        key={entry.item.id}
                        type="button"
                        data-palette-index={entry.index}
                        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                          entry.index === selectedIndex
                            ? 'bg-cyan-500/20 text-cyan-50'
                            : 'text-foreground/90 hover:bg-white/10'
                        }`}
                        onMouseEnter={() => setSelectedIndex(entry.index)}
                        onClick={async () => {
                          await runItem(entry.item);
                          setPalette(false);
                        }}
                      >
                        <span>{entry.item.label}</span>
                        {entry.item.hint ? (
                          <span className="text-muted-foreground/90 ml-3 text-xs">{entry.item.hint}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
