import { useMemo, useState, type ReactElement } from 'react';
import {
  ChevronRight,
  CircleX,
  FileCode2,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  FilePlus2,
  Pencil,
  Search,
  Trash2
} from 'lucide-react';
import type { FileNode } from '@/common/ipc';
import { useAppStore } from '@/renderer/state/app-store';
import { ContextMenu, type ContextMenuItem } from '@/renderer/components/ui/context-menu';
import { useModalStore } from '@/renderer/state/modal-store';
import { validateFileSystemName } from '@/renderer/lib/validators';

function getFileIcon(fileName: string): ReactElement {
  if (
    fileName.endsWith('.ts') ||
    fileName.endsWith('.tsx') ||
    fileName.endsWith('.js') ||
    fileName.endsWith('.jsx')
  ) {
    return <FileCode2 className="h-4 w-4 text-cyan-300" />;
  }
  if (fileName.endsWith('.json')) {
    return <FileJson className="h-4 w-4 text-amber-300" />;
  }
  return <FileText className="h-4 w-4 text-slate-300" />;
}

function toRelative(pathValue: string, workspacePath: string | null): string {
  if (!workspacePath) {
    return pathValue;
  }

  const normalizedWorkspace = workspacePath.replace(/\\/g, '/');
  const normalizedPath = pathValue.replace(/\\/g, '/');
  if (!normalizedPath.startsWith(normalizedWorkspace)) {
    return pathValue;
  }
  return normalizedPath.slice(normalizedWorkspace.length + 1);
}

type TreeNodeProps = {
  node: FileNode;
  gitStatusByPath: Record<string, string>;
  forceExpanded: boolean;
  onOpenFile: (filePath: string) => void;
  onCreateFile: (directoryPath: string) => void;
  onCreateFolder: (directoryPath: string) => void;
  onRename: (targetPath: string, currentName: string) => void;
  onDelete: (node: FileNode) => void;
  onRevealInFinder: (targetPath: string) => void;
};

function countDescendants(node: FileNode): number {
  if (node.type === 'file' || !node.children) {
    return 0;
  }

  return node.children.reduce((count, child) => {
    return count + 1 + countDescendants(child);
  }, 0);
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/');
}

function getStatusKind(
  code: string | undefined
): 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflict' | null {
  if (!code) {
    return null;
  }
  if (code === '??') {
    return 'untracked';
  }
  if (code.includes('U')) {
    return 'conflict';
  }
  if (code.includes('D')) {
    return 'deleted';
  }
  if (code.includes('R') || code.includes('C')) {
    return 'renamed';
  }
  if (code.includes('A')) {
    return 'added';
  }
  if (code.includes('M')) {
    return 'modified';
  }
  return null;
}

function getStatusBadge(code: string | undefined): { label: string; className: string } | null {
  const kind = getStatusKind(code);
  if (!kind) {
    return null;
  }

  if (kind === 'modified') {
    return { label: 'M', className: 'border-amber-400/40 bg-amber-500/15 text-amber-200' };
  }
  if (kind === 'added') {
    return { label: 'A', className: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200' };
  }
  if (kind === 'deleted') {
    return { label: 'D', className: 'border-rose-400/40 bg-rose-500/15 text-rose-200' };
  }
  if (kind === 'renamed') {
    return { label: 'R', className: 'border-sky-400/40 bg-sky-500/15 text-sky-200' };
  }
  if (kind === 'untracked') {
    return { label: 'U', className: 'border-lime-400/40 bg-lime-500/15 text-lime-200' };
  }
  return { label: '!', className: 'border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-100' };
}

function getNodeStatusCode(node: FileNode, gitStatusByPath: Record<string, string>): string | undefined {
  const nodePath = normalizePath(node.path);
  if (node.type === 'file') {
    return gitStatusByPath[nodePath];
  }

  const candidateCodes: string[] = [];
  const prefix = `${nodePath}/`;
  for (const [filePath, code] of Object.entries(gitStatusByPath)) {
    if (filePath.startsWith(prefix)) {
      candidateCodes.push(code);
    }
  }

  const priority: Array<ReturnType<typeof getStatusKind>> = [
    'conflict',
    'deleted',
    'modified',
    'added',
    'renamed',
    'untracked'
  ];
  for (const target of priority) {
    const match = candidateCodes.find((candidate) => getStatusKind(candidate) === target);
    if (match) {
      return match;
    }
  }

  return undefined;
}

function filterNodes(nodes: FileNode[], query: string): FileNode[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return nodes;
  }

  const walk = (node: FileNode): FileNode | null => {
    const normalizedPath = normalizePath(node.path).toLowerCase();
    const nodeMatch = node.name.toLowerCase().includes(trimmed) || normalizedPath.includes(trimmed);

    if (node.type === 'file') {
      return nodeMatch ? node : null;
    }

    const childMatches = (node.children ?? []).map(walk).filter((child): child is FileNode => Boolean(child));
    if (nodeMatch || childMatches.length > 0) {
      return {
        ...node,
        children: childMatches
      };
    }

    return null;
  };

  return nodes.map(walk).filter((node): node is FileNode => Boolean(node));
}

function TreeNode(props: TreeNodeProps): ReactElement {
  const [expanded, setExpanded] = useState(props.forceExpanded);
  const [menuState, setMenuState] = useState<{ open: boolean; x: number; y: number }>({
    open: false,
    x: 0,
    y: 0
  });
  const isDirectory = props.node.type === 'directory';
  const isExpanded = props.forceExpanded || expanded;
  const gitBadge = getStatusBadge(getNodeStatusCode(props.node, props.gitStatusByPath));

  const items: ContextMenuItem[] = isDirectory
    ? [
        {
          id: 'new-file',
          label: 'New File',
          onSelect: () => props.onCreateFile(props.node.path)
        },
        {
          id: 'new-folder',
          label: 'New Folder',
          onSelect: () => props.onCreateFolder(props.node.path)
        },
        {
          id: 'rename',
          label: 'Rename',
          onSelect: () => props.onRename(props.node.path, props.node.name)
        },
        {
          id: 'delete',
          label: 'Delete',
          destructive: true,
          onSelect: () => props.onDelete(props.node)
        },
        {
          id: 'reveal',
          label: 'Reveal in Finder',
          onSelect: () => props.onRevealInFinder(props.node.path)
        }
      ]
    : [
        {
          id: 'open',
          label: 'Open',
          onSelect: () => props.onOpenFile(props.node.path)
        },
        {
          id: 'rename',
          label: 'Rename',
          onSelect: () => props.onRename(props.node.path, props.node.name)
        },
        {
          id: 'delete',
          label: 'Delete',
          destructive: true,
          onSelect: () => props.onDelete(props.node)
        },
        {
          id: 'reveal',
          label: 'Reveal in Finder',
          onSelect: () => props.onRevealInFinder(props.node.path)
        }
      ];

  return (
    <div>
      <div
        className="text-foreground/85 group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white/5"
        onContextMenu={(event) => {
          event.preventDefault();
          setMenuState({ open: true, x: event.clientX, y: event.clientY });
        }}
      >
        {isDirectory ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-white/10"
            title={expanded ? 'Collapse folder' : 'Expand folder'}
            aria-label={expanded ? 'Collapse folder' : 'Expand folder'}
            disabled={props.forceExpanded}
          >
            <ChevronRight className={`h-4 w-4 transition ${isExpanded ? 'rotate-90' : ''}`} />
          </button>
        ) : (
          <span className="inline-block h-5 w-5" />
        )}

        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => {
            if (isDirectory) {
              setExpanded((value) => !value);
              return;
            }
            props.onOpenFile(props.node.path);
          }}
        >
          {isDirectory ? (
            expanded ? (
              <FolderOpen className="h-4 w-4 text-amber-300" />
            ) : (
              <Folder className="h-4 w-4 text-amber-300" />
            )
          ) : (
            getFileIcon(props.node.name)
          )}
          <span className="truncate">{props.node.name}</span>
          {gitBadge ? (
            <span
              className={`rounded border px-1 py-0 text-[10px] leading-none ${gitBadge.className}`}
              title={`Git: ${gitBadge.label}`}
            >
              {gitBadge.label}
            </span>
          ) : null}
        </button>

        <div className="hidden items-center gap-1 group-hover:flex">
          {isDirectory ? (
            <>
              <button
                type="button"
                className="rounded p-1 hover:bg-white/10"
                title="New file"
                onClick={() => props.onCreateFile(props.node.path)}
              >
                <FilePlus2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="rounded p-1 hover:bg-white/10"
                title="New folder"
                onClick={() => props.onCreateFolder(props.node.path)}
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="rounded p-1 hover:bg-white/10"
            title="Rename"
            onClick={() => props.onRename(props.node.path, props.node.name)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="rounded p-1 hover:bg-red-500/20"
            title="Delete"
            onClick={() => props.onDelete(props.node)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {isDirectory && isExpanded && props.node.children ? (
        <div className="ml-4">
          {props.node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              gitStatusByPath={props.gitStatusByPath}
              forceExpanded={props.forceExpanded}
              onOpenFile={props.onOpenFile}
              onCreateFile={props.onCreateFile}
              onCreateFolder={props.onCreateFolder}
              onRename={props.onRename}
              onDelete={props.onDelete}
              onRevealInFinder={props.onRevealInFinder}
            />
          ))}
        </div>
      ) : null}

      <ContextMenu
        open={menuState.open}
        x={menuState.x}
        y={menuState.y}
        items={items}
        onClose={() => setMenuState({ open: false, x: 0, y: 0 })}
      />
    </div>
  );
}

export function FileExplorer(): ReactElement {
  const workspacePath = useAppStore((state) => state.workspacePath);
  const fileTree = useAppStore((state) => state.fileTree);
  const openWorkspaceFolder = useAppStore((state) => state.openWorkspaceFolder);
  const refreshWorkspaceTree = useAppStore((state) => state.refreshWorkspaceTree);
  const openFile = useAppStore((state) => state.openFile);
  const createFile = useAppStore((state) => state.createFile);
  const createFolder = useAppStore((state) => state.createFolder);
  const renamePath = useAppStore((state) => state.renamePath);
  const deletePath = useAppStore((state) => state.deletePath);
  const revealInFinder = useAppStore((state) => state.revealInFinder);
  const gitStatusByPath = useAppStore((state) => state.gitStatusByPath);
  const requestConfirm = useModalStore((state) => state.requestConfirm);
  const requestInput = useModalStore((state) => state.requestInput);
  const [filterQuery, setFilterQuery] = useState('');

  const workspaceLabel = useMemo(() => {
    if (!workspacePath) {
      return 'No workspace opened';
    }
    const normalized = workspacePath.replace(/\\/g, '/');
    return normalized.split('/').pop() ?? workspacePath;
  }, [workspacePath]);

  const filteredTree = useMemo(() => filterNodes(fileTree, filterQuery), [fileTree, filterQuery]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between border-b border-white/10 px-2 pb-2">
        <div>
          <p className="text-muted-foreground text-xs uppercase tracking-wide">Explorer</p>
          <p className="text-foreground text-sm font-medium">{workspaceLabel}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded p-1.5 hover:bg-white/10 disabled:opacity-40"
            title="New file in workspace root"
            disabled={!workspacePath}
            onClick={() => {
              void (async () => {
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
              })();
            }}
          >
            <FilePlus2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded p-1.5 hover:bg-white/10 disabled:opacity-40"
            title="New folder in workspace root"
            disabled={!workspacePath}
            onClick={() => {
              void (async () => {
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
              })();
            }}
          >
            <FolderPlus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded p-1.5 hover:bg-white/10"
            title="Open folder"
            onClick={() => {
              void openWorkspaceFolder();
            }}
          >
            <FolderOpen className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded p-1.5 hover:bg-white/10"
            title="Refresh"
            onClick={() => {
              void refreshWorkspaceTree();
            }}
          >
            <ChevronRight className="h-4 w-4 rotate-90" />
          </button>
        </div>
      </div>

      {workspacePath ? (
        <div className="mb-2 px-2">
          <label className="text-muted-foreground flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <input
              value={filterQuery}
              onChange={(event) => setFilterQuery(event.target.value)}
              placeholder="Filter files"
              className="text-foreground placeholder:text-muted-foreground/70 h-5 w-full bg-transparent text-xs outline-none"
            />
            {filterQuery ? (
              <button
                type="button"
                className="rounded p-0.5 hover:bg-white/10"
                onClick={() => setFilterQuery('')}
                title="Clear filter"
                aria-label="Clear filter"
              >
                <CircleX className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </label>
        </div>
      ) : null}

      {!workspacePath ? (
        <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 px-2 text-center text-sm">
          <p>Select a workspace to start editing files.</p>
          <button
            type="button"
            className="rounded-md bg-cyan-500/20 px-3 py-1.5 text-cyan-100 hover:bg-cyan-500/30"
            onClick={() => {
              void openWorkspaceFolder();
            }}
          >
            Open Folder
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="text-muted-foreground mb-2 px-2 text-[11px]">
            {toRelative(workspacePath, workspacePath)}
          </div>
          {filteredTree.length === 0 ? (
            <div className="text-muted-foreground px-2 text-xs">No files match this filter.</div>
          ) : null}
          {filteredTree.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              gitStatusByPath={gitStatusByPath}
              forceExpanded={Boolean(filterQuery.trim())}
              onOpenFile={(filePath) => {
                void openFile(filePath);
              }}
              onCreateFile={(directoryPath) => {
                void (async () => {
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
                  await createFile(directoryPath, fileName);
                })();
              }}
              onCreateFolder={(directoryPath) => {
                void (async () => {
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
                  await createFolder(directoryPath, folderName);
                })();
              }}
              onRename={(targetPath, currentName) => {
                void (async () => {
                  const newName = await requestInput({
                    title: `Rename ${currentName}`,
                    description: 'Enter a new name',
                    initialValue: currentName,
                    confirmLabel: 'Rename',
                    validate: validateFileSystemName
                  });
                  if (!newName || newName === currentName) {
                    return;
                  }
                  await renamePath(targetPath, newName);
                })();
              }}
              onDelete={(node) => {
                void (async () => {
                  const descendantCount = countDescendants(node);
                  const deleteDescription =
                    node.type === 'directory'
                      ? `This will permanently remove the folder and ${descendantCount} nested item${
                          descendantCount === 1 ? '' : 's'
                        }.`
                      : 'This action cannot be undone.';
                  const confirmed = await requestConfirm({
                    title: `Delete ${node.name}?`,
                    description: deleteDescription,
                    confirmLabel: 'Delete',
                    destructive: true
                  });
                  if (!confirmed) {
                    return;
                  }
                  await deletePath(node.path);
                })();
              }}
              onRevealInFinder={(targetPath) => {
                void revealInFinder(targetPath);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
