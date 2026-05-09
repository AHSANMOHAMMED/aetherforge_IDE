import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { ArrowDown, ArrowUp, Check, GitBranch, GitCommit, Plus, RefreshCw, Undo2 } from 'lucide-react';
import { useAppStore } from '@/renderer/state/app-store';
import type { GitFileStatusEntry } from '@/common/ipc';
import { logActivity } from '@/renderer/state/activity-store';
import { useToastStore } from '@/renderer/state/toast-store';

type StagedSplit = {
  staged: GitFileStatusEntry[];
  unstaged: GitFileStatusEntry[];
};

function classify(entries: GitFileStatusEntry[]): StagedSplit {
  const staged: GitFileStatusEntry[] = [];
  const unstaged: GitFileStatusEntry[] = [];
  for (const e of entries) {
    const idx = e.code[0];
    const wt = e.code[1];
    if (idx && idx !== ' ' && idx !== '?') staged.push(e);
    if (wt && wt !== ' ' && wt !== '?') unstaged.push(e);
    if (e.code === '??') unstaged.push(e);
  }
  return { staged, unstaged };
}

function describeCode(code: string): string {
  const map: Record<string, string> = {
    M: 'Modified',
    A: 'Added',
    D: 'Deleted',
    R: 'Renamed',
    C: 'Copied',
    U: 'Conflict',
    '?': 'Untracked',
    '!': 'Ignored'
  };
  const idx = code[0];
  return map[idx] ?? code;
}

export function SourceControlPanel(): ReactElement {
  const workspacePath = useAppStore((s) => s.workspacePath);
  const branch = useAppStore((s) => s.currentBranch);
  const refreshGit = useAppStore((s) => s.refreshGitStatus);
  const gitStatusByPath = useAppStore((s) => s.gitStatusByPath);
  const pushToast = useToastStore((s) => s.pushToast);
  const [entries, setEntries] = useState<GitFileStatusEntry[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [ahead, setAhead] = useState(0);
  const [behind, setBehind] = useState(0);

  const refresh = useCallback(async () => {
    if (!workspacePath || !window.electronAPI?.getGitStatus) return;
    const result = await window.electronAPI.getGitStatus(workspacePath);
    if (result.ok) {
      setEntries(result.entries);
      setAhead(result.ahead ?? 0);
      setBehind(result.behind ?? 0);
    }
  }, [workspacePath]);

  useEffect(() => {
    void refresh();
  }, [refresh, gitStatusByPath]);

  const stage = useCallback(
    async (paths: string[]) => {
      if (!workspacePath || !window.electronAPI?.gitStage) return;
      setBusy(true);
      try {
        const r = await window.electronAPI.gitStage({ workspacePath, paths });
        if (!r.ok)
          pushToast({ level: 'error', title: 'Stage failed', description: r.error, durationMs: 3000 });
        await refresh();
        await refreshGit();
      } finally {
        setBusy(false);
      }
    },
    [pushToast, refresh, refreshGit, workspacePath]
  );

  const unstage = useCallback(
    async (paths: string[]) => {
      if (!workspacePath || !window.electronAPI?.gitUnstage) return;
      setBusy(true);
      try {
        const r = await window.electronAPI.gitUnstage({ workspacePath, paths });
        if (!r.ok)
          pushToast({ level: 'error', title: 'Unstage failed', description: r.error, durationMs: 3000 });
        await refresh();
        await refreshGit();
      } finally {
        setBusy(false);
      }
    },
    [pushToast, refresh, refreshGit, workspacePath]
  );

  const commit = useCallback(async () => {
    if (!workspacePath || !window.electronAPI?.gitCommit || !message.trim()) return;
    setBusy(true);
    try {
      const r = await window.electronAPI.gitCommit({ workspacePath, message: message.trim() });
      if (r.ok) {
        logActivity('git', `Committed ${r.hash?.slice(0, 7) ?? ''}`, { severity: 'success' });
        setMessage('');
      } else {
        pushToast({ level: 'error', title: 'Commit failed', description: r.error, durationMs: 4000 });
      }
      await refresh();
      await refreshGit();
    } finally {
      setBusy(false);
    }
  }, [message, pushToast, refresh, refreshGit, workspacePath]);

  const push = useCallback(async () => {
    if (!workspacePath || !window.electronAPI?.gitPush) return;
    setBusy(true);
    try {
      const r = await window.electronAPI.gitPush({ workspacePath });
      if (r.ok) {
        logActivity('git', 'Pushed to remote', { severity: 'success' });
      } else {
        pushToast({ level: 'error', title: 'Push failed', description: r.error, durationMs: 4000 });
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [pushToast, refresh, workspacePath]);

  const pull = useCallback(async () => {
    if (!workspacePath || !window.electronAPI?.gitPull) return;
    setBusy(true);
    try {
      const r = await window.electronAPI.gitPull({ workspacePath });
      if (r.ok) {
        logActivity('git', 'Pulled from remote', { severity: 'success' });
      } else {
        pushToast({ level: 'error', title: 'Pull failed', description: r.error, durationMs: 4000 });
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [pushToast, refresh, workspacePath]);

  const split = classify(entries);

  if (!workspacePath) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
        Open a workspace to use Source Control
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col text-sm">
      <div className="border-border/40 flex items-center justify-between border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <GitBranch size={14} />
          <span className="truncate font-medium">{branch || 'no branch'}</span>
          {ahead > 0 && (
            <span className="flex items-center gap-0.5 text-emerald-400" title={`${ahead} ahead`}>
              <ArrowUp size={10} /> {ahead}
            </span>
          )}
          {behind > 0 && (
            <span className="flex items-center gap-0.5 text-amber-400" title={`${behind} behind`}>
              <ArrowDown size={10} /> {behind}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
            aria-label="Refresh git status"
            className="text-muted-foreground hover:bg-secondary/40 hover:text-foreground rounded p-1"
          >
            <RefreshCw size={12} />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void pull()}
            aria-label="Pull"
            className="text-muted-foreground hover:bg-secondary/40 hover:text-foreground rounded p-1"
          >
            <ArrowDown size={12} />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void push()}
            aria-label="Push"
            className="text-muted-foreground hover:bg-secondary/40 hover:text-foreground rounded p-1"
          >
            <ArrowUp size={12} />
          </button>
        </div>
      </div>

      <div className="border-border/40 flex flex-col gap-2 border-b p-2">
        <textarea
          rows={2}
          aria-label="Commit message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Commit message"
          className="border-border/40 bg-background/60 focus-visible:outline-primary resize-none rounded-md border px-2 py-1 text-xs focus-visible:outline focus-visible:outline-1"
        />
        <button
          type="button"
          disabled={busy || !message.trim() || split.staged.length === 0}
          onClick={() => void commit()}
          className="bg-primary/80 text-primary-foreground hover:bg-primary flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-medium disabled:opacity-40"
        >
          <GitCommit size={12} /> Commit ({split.staged.length})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1 text-xs">
        {split.staged.length > 0 && (
          <div className="mb-2">
            <div className="text-muted-foreground mb-1 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider">Staged</span>
              <button
                type="button"
                onClick={() => void unstage(split.staged.map((e) => e.path))}
                className="text-muted-foreground hover:text-foreground text-[10px]"
                aria-label="Unstage all"
              >
                Unstage all
              </button>
            </div>
            {split.staged.map((entry) => (
              <FileRow
                key={`s-${entry.path}`}
                entry={entry}
                action={
                  <button
                    type="button"
                    aria-label={`Unstage ${entry.path}`}
                    onClick={() => void unstage([entry.path])}
                    className="text-muted-foreground hover:bg-secondary/40 hover:text-foreground rounded p-0.5"
                  >
                    <Undo2 size={11} />
                  </button>
                }
              />
            ))}
          </div>
        )}

        {split.unstaged.length > 0 && (
          <div className="mb-2">
            <div className="text-muted-foreground mb-1 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider">Changes</span>
              <button
                type="button"
                onClick={() => void stage(split.unstaged.map((e) => e.path))}
                className="text-muted-foreground hover:text-foreground text-[10px]"
                aria-label="Stage all"
              >
                Stage all
              </button>
            </div>
            {split.unstaged.map((entry) => (
              <FileRow
                key={`u-${entry.path}`}
                entry={entry}
                action={
                  <button
                    type="button"
                    aria-label={`Stage ${entry.path}`}
                    onClick={() => void stage([entry.path])}
                    className="text-muted-foreground hover:bg-secondary/40 hover:text-foreground rounded p-0.5"
                  >
                    <Plus size={11} />
                  </button>
                }
              />
            ))}
          </div>
        )}

        {split.staged.length === 0 && split.unstaged.length === 0 && (
          <div className="text-muted-foreground flex items-center justify-center gap-1 py-4">
            <Check size={12} /> Working tree clean
          </div>
        )}
      </div>
    </div>
  );
}

function FileRow({ entry, action }: { entry: GitFileStatusEntry; action: ReactElement }): ReactElement {
  const name = entry.path.split('/').pop() ?? entry.path;
  return (
    <div className="hover:bg-secondary/30 group flex items-center gap-1 rounded px-1 py-0.5">
      <span className="w-5 text-center text-[10px] font-bold" title={describeCode(entry.code)}>
        {entry.code.trim() || '?'}
      </span>
      <span className="min-w-0 flex-1 truncate" title={entry.path}>
        {name}
      </span>
      <span className="opacity-0 group-hover:opacity-100">{action}</span>
    </div>
  );
}
