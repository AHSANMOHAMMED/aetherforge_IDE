/**
 * Persist virtual / generated artifacts under `.aetherforge/` inside the
 * active workspace so they survive reloads and can be committed to VCS.
 */

const DIR = '.aetherforge';

export function aetherforgeDir(workspacePath: string): string {
  const sep = workspacePath.includes('\\') ? '\\' : '/';
  return `${workspacePath.replace(/[/\\]+$/, '')}${sep}${DIR}`;
}

export function virtualPathToDisk(workspacePath: string, virtualPath: string): string | null {
  if (!virtualPath.startsWith('virtual://')) return null;
  const rest = virtualPath.replace(/^virtual:\/\//, '').replace(/^\/+/, '');
  const sep = workspacePath.includes('\\') ? '\\' : '/';
  return `${aetherforgeDir(workspacePath)}${sep}${rest.replace(/\//g, sep)}`;
}
