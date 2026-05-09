import { mkdir, readFile, rename, rm, stat, writeFile, realpath } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

/**
 * Path-sandboxing primitives.
 *
 * Every FS write/read crossing IPC must resolve to a real path inside an allowed
 * root directory. This blocks `..` escapes, symlink-out-of-tree, and absolute
 * paths pointing at user secrets, system files, etc.
 */

let allowedRoots: string[] = [];

export function setAllowedRoots(roots: string[]): void {
  allowedRoots = roots.filter((r) => typeof r === 'string' && r.length > 0).map((r) => path.resolve(r));
}

export function getAllowedRoots(): string[] {
  return [...allowedRoots];
}

export class PathSandboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathSandboxError';
  }
}

function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel.length > 0 && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Resolve a path safely. The result is guaranteed to live inside one of the
 * allowed roots. If the path does not exist yet (e.g. for a `create`), the
 * parent directory is checked instead.
 */
export async function resolveSafePath(targetPath: string, opts?: { mustExist?: boolean }): Promise<string> {
  if (allowedRoots.length === 0) {
    throw new PathSandboxError('No workspace is open. File operations are blocked.');
  }
  const absolute = path.resolve(targetPath);
  const exists = existsSync(absolute);
  let resolvedTarget = absolute;
  try {
    if (exists) {
      resolvedTarget = await realpath(absolute);
    } else {
      // For non-existing files we resolve the parent's realpath instead, then re-attach the basename.
      const parentReal = await realpath(path.dirname(absolute));
      resolvedTarget = path.join(parentReal, path.basename(absolute));
    }
  } catch (err) {
    throw new PathSandboxError(`Failed to resolve path: ${(err as Error).message}`);
  }

  if (opts?.mustExist && !exists) {
    throw new PathSandboxError(`Path does not exist: ${targetPath}`);
  }

  for (const root of allowedRoots) {
    if (resolvedTarget === root || isInside(resolvedTarget, root)) {
      return resolvedTarget;
    }
  }

  throw new PathSandboxError(`Path "${targetPath}" is outside the allowed workspace.`);
}

export async function readTextFile(filePath: string): Promise<string> {
  const safe = await resolveSafePath(filePath, { mustExist: true });
  return readFile(safe, 'utf-8');
}

export async function readFileMeta(filePath: string): Promise<{
  content: string;
  size: number;
  mtime: number;
}> {
  const safe = await resolveSafePath(filePath, { mustExist: true });
  const [content, st] = await Promise.all([readFile(safe, 'utf-8'), stat(safe)]);
  return { content, size: st.size, mtime: st.mtimeMs };
}

/**
 * Atomic write: write to a temp file inside the same directory, then rename.
 * This guarantees the destination either has the old content or the new content,
 * never a partially-written file (which is what causes the classic "save on
 * power-loss eats my code" failures).
 */
export async function writeTextFile(filePath: string, content: string): Promise<void> {
  const safe = await resolveSafePath(filePath);
  const dir = path.dirname(safe);
  await mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(safe)}.${randomBytes(6).toString('hex')}.tmp`);
  await writeFile(tmp, content, { encoding: 'utf-8' });
  try {
    await rename(tmp, safe);
  } catch (err) {
    try {
      await rm(tmp, { force: true });
    } catch {
      // best effort cleanup
    }
    throw err;
  }
}

export async function writeTextFileWithConflictCheck(
  filePath: string,
  content: string,
  expectedMtime: number | null
): Promise<{ ok: true; mtime: number } | { ok: false; reason: 'conflict'; currentMtime: number }> {
  const safe = await resolveSafePath(filePath);
  if (expectedMtime != null && existsSync(safe)) {
    const st = await stat(safe);
    if (Math.abs(st.mtimeMs - expectedMtime) > 1) {
      return { ok: false, reason: 'conflict', currentMtime: st.mtimeMs };
    }
  }
  await writeTextFile(safe, content);
  const st = await stat(safe);
  return { ok: true, mtime: st.mtimeMs };
}

export async function createFile(directoryPath: string, fileName: string): Promise<void> {
  if (fileName.includes('/') || fileName.includes('\\') || fileName === '.' || fileName === '..') {
    throw new PathSandboxError('Invalid file name');
  }
  const safeDir = await resolveSafePath(directoryPath);
  await mkdir(safeDir, { recursive: true });
  const fullPath = path.join(safeDir, fileName);
  // re-validate that the join didn't escape (defensive)
  await resolveSafePath(fullPath);
  await writeFile(fullPath, '', { flag: 'wx' });
}

export async function createFolder(directoryPath: string, folderName: string): Promise<void> {
  if (folderName.includes('/') || folderName.includes('\\') || folderName === '.' || folderName === '..') {
    throw new PathSandboxError('Invalid folder name');
  }
  const safeDir = await resolveSafePath(directoryPath);
  const fullPath = path.join(safeDir, folderName);
  await resolveSafePath(fullPath);
  await mkdir(fullPath, { recursive: false });
}

export async function renamePath(targetPath: string, newName: string): Promise<void> {
  if (newName.includes('/') || newName.includes('\\') || newName === '.' || newName === '..') {
    throw new PathSandboxError('Invalid name');
  }
  const safe = await resolveSafePath(targetPath, { mustExist: true });
  const parentDirectory = path.dirname(safe);
  const destination = path.join(parentDirectory, newName);
  await resolveSafePath(destination);
  await rename(safe, destination);
}

export async function movePath(sourcePath: string, destinationPath: string): Promise<void> {
  const safeSource = await resolveSafePath(sourcePath, { mustExist: true });
  const safeDest = await resolveSafePath(destinationPath);
  await mkdir(path.dirname(safeDest), { recursive: true });
  await rename(safeSource, safeDest);
}

export async function deletePath(targetPath: string): Promise<void> {
  const safe = await resolveSafePath(targetPath, { mustExist: true });
  const fileStats = await stat(safe);
  if (fileStats.isDirectory()) {
    await rm(safe, { recursive: true, force: false });
    return;
  }
  await rm(safe, { force: false });
}
