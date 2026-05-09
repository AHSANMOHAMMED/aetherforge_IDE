import { existsSync } from 'node:fs';
import path from 'node:path';
import { simpleGit, type SimpleGit } from 'simple-git';
import type {
  GitBlamePayload,
  GitBlameResult,
  GitBranchListResult,
  GitCommitPayload,
  GitCommitResult,
  GitDiffPayload,
  GitDiffResult,
  GitLogPayload,
  GitLogResult,
  GitPullPayload,
  GitPushPayload,
  GitStagePayload,
  GitStatusResult,
  OperationResult
} from '../../src/common/ipc';
import logger from '../logger';

function git(workspacePath: string): SimpleGit | null {
  if (!existsSync(workspacePath)) return null;
  return simpleGit({ baseDir: workspacePath });
}

function isRepoError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /not a git repository/i.test(msg);
}

export async function getStatus(workspacePath: string): Promise<GitStatusResult> {
  const g = git(workspacePath);
  if (!g) {
    return { ok: false, branch: '', entries: [], error: 'Workspace path is not accessible.' };
  }
  try {
    const status = await g.status();
    return {
      ok: true,
      branch: status.current ?? 'HEAD',
      ahead: status.ahead,
      behind: status.behind,
      entries: status.files.map((f) => ({
        path: f.path,
        code: `${f.index}${f.working_dir}`.trim() || '?'
      }))
    };
  } catch (err) {
    if (isRepoError(err)) {
      return { ok: true, branch: 'no-git', entries: [] };
    }
    logger.error('git.status failed', err);
    return { ok: false, branch: '', entries: [], error: (err as Error).message };
  }
}

export async function getLog(payload: GitLogPayload): Promise<GitLogResult> {
  const g = git(payload.workspacePath);
  if (!g) return { ok: false, entries: [], error: 'Workspace not accessible' };
  try {
    const log = await g.log({
      maxCount: payload.limit ?? 100,
      file: payload.file
    });
    return {
      ok: true,
      entries: log.all.map((c) => ({
        hash: c.hash,
        abbreviated: c.hash.slice(0, 7),
        author: c.author_name,
        email: c.author_email,
        date: new Date(c.date).getTime(),
        subject: c.message,
        body: c.body || undefined
      }))
    };
  } catch (err) {
    return { ok: false, entries: [], error: (err as Error).message };
  }
}

export async function getDiff(payload: GitDiffPayload): Promise<GitDiffResult> {
  const g = git(payload.workspacePath);
  if (!g) return { ok: false, diff: '', error: 'Workspace not accessible' };
  try {
    const args: string[] = [];
    if (payload.staged) args.push('--cached');
    if (payload.path) args.push('--', payload.path);
    const diff = await g.diff(args);
    return { ok: true, diff };
  } catch (err) {
    return { ok: false, diff: '', error: (err as Error).message };
  }
}

export async function stage(payload: GitStagePayload): Promise<OperationResult> {
  const g = git(payload.workspacePath);
  if (!g) return { ok: false, error: 'Workspace not accessible' };
  try {
    await g.add(payload.paths);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function unstage(payload: GitStagePayload): Promise<OperationResult> {
  const g = git(payload.workspacePath);
  if (!g) return { ok: false, error: 'Workspace not accessible' };
  try {
    await g.reset(['HEAD', '--', ...payload.paths]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function commit(payload: GitCommitPayload): Promise<GitCommitResult> {
  const g = git(payload.workspacePath);
  if (!g) return { ok: false, error: 'Workspace not accessible' };
  try {
    const opts: Record<string, string | null> = {};
    if (payload.signoff) opts['--signoff'] = null;
    const res = await g.commit(payload.message, undefined, opts);
    return { ok: true, hash: res.commit };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function push(payload: GitPushPayload): Promise<OperationResult> {
  const g = git(payload.workspacePath);
  if (!g) return { ok: false, error: 'Workspace not accessible' };
  try {
    const opts: string[] = [];
    if (payload.force) opts.push('--force-with-lease');
    await g.push(payload.remote ?? 'origin', payload.branch ?? 'HEAD', opts);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function pull(payload: GitPullPayload): Promise<OperationResult> {
  const g = git(payload.workspacePath);
  if (!g) return { ok: false, error: 'Workspace not accessible' };
  try {
    await g.pull(payload.remote ?? 'origin', payload.branch);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function branchList(workspacePath: string): Promise<GitBranchListResult> {
  const g = git(workspacePath);
  if (!g) return { ok: false, current: '', all: [], error: 'Workspace not accessible' };
  try {
    const summary = await g.branch(['--all']);
    return {
      ok: true,
      current: summary.current,
      all: summary.all.map((name) => ({
        name,
        remote: name.startsWith('remotes/'),
        commit: summary.branches[name]?.commit
      }))
    };
  } catch (err) {
    return { ok: false, current: '', all: [], error: (err as Error).message };
  }
}

export async function branchCreate(payload: {
  workspacePath: string;
  name: string;
  checkout?: boolean;
}): Promise<OperationResult> {
  const g = git(payload.workspacePath);
  if (!g) return { ok: false, error: 'Workspace not accessible' };
  try {
    if (payload.checkout) {
      await g.checkoutLocalBranch(payload.name);
    } else {
      await g.branch([payload.name]);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function branchCheckout(payload: {
  workspacePath: string;
  name: string;
}): Promise<OperationResult> {
  const g = git(payload.workspacePath);
  if (!g) return { ok: false, error: 'Workspace not accessible' };
  try {
    await g.checkout(payload.name);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function blame(payload: GitBlamePayload): Promise<GitBlameResult> {
  const g = git(payload.workspacePath);
  if (!g) return { ok: false, lines: [], error: 'Workspace not accessible' };
  try {
    const rel = path.relative(payload.workspacePath, payload.path);
    const raw = await g.raw(['blame', '--porcelain', rel]);
    const lines: GitBlameResult['lines'] = [];
    let currentMeta: { hash: string; author: string; date: number } | null = null;
    let lineNum = 0;

    for (const ln of raw.split('\n')) {
      if (/^[0-9a-f]{40}\s/.test(ln)) {
        const [hash, , origLine] = ln.split(' ');
        currentMeta = { hash, author: '', date: 0 };
        lineNum = parseInt(origLine ?? '0', 10) || 0;
      } else if (ln.startsWith('author ') && currentMeta) {
        currentMeta.author = ln.slice(7);
      } else if (ln.startsWith('author-time ') && currentMeta) {
        currentMeta.date = parseInt(ln.slice(12), 10) * 1000;
      } else if (ln.startsWith('\t') && currentMeta) {
        lines.push({
          hash: currentMeta.hash,
          author: currentMeta.author,
          date: currentMeta.date,
          line: lineNum,
          content: ln.slice(1)
        });
      }
    }
    return { ok: true, lines };
  } catch (err) {
    return { ok: false, lines: [], error: (err as Error).message };
  }
}
