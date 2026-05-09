import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { rgPath } from '@vscode/ripgrep';
import type { SearchHit, SearchInFilesPayload, SearchInFilesResult } from '../../src/common/ipc';
import logger from '../logger';

function buildArgs(payload: SearchInFilesPayload): string[] {
  const args = ['--json', '--no-ignore-vcs', '--smart-case', '--max-columns', '500'];
  if (payload.caseSensitive) args.push('-s');
  if (!payload.isRegex) args.push('-F');
  if (payload.includeGlobs) {
    for (const g of payload.includeGlobs) args.push('-g', g);
  }
  if (payload.excludeGlobs) {
    for (const g of payload.excludeGlobs) args.push('-g', `!${g}`);
  } else {
    for (const ex of ['!**/node_modules/**', '!**/dist/**', '!**/dist-electron/**', '!**/.git/**']) {
      args.push('-g', ex);
    }
  }
  args.push('--', payload.query, payload.workspacePath);
  return args;
}

export async function searchInFiles(payload: SearchInFilesPayload): Promise<SearchInFilesResult> {
  if (!existsSync(payload.workspacePath)) {
    return { ok: false, hits: [], truncated: false, error: 'Workspace not found' };
  }
  const max = payload.maxResults ?? 5000;
  const hits: SearchHit[] = [];
  let truncated = false;

  return new Promise((resolve) => {
    const proc = spawn(rgPath, buildArgs(payload), { cwd: payload.workspacePath });
    let buffer = '';
    let killed = false;

    proc.stdout.setEncoding('utf-8');
    proc.stdout.on('data', (chunk: string) => {
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        try {
          const obj = JSON.parse(line) as
            | {
                type: 'match';
                data: {
                  path: { text: string };
                  lines: { text: string };
                  line_number: number;
                  submatches: { start: number }[];
                };
              }
            | { type: 'begin' | 'end' | 'summary'; data: unknown };
          if (obj.type === 'match') {
            const m = obj.data;
            const col = m.submatches?.[0]?.start ?? 0;
            hits.push({
              path: path.resolve(payload.workspacePath, m.path.text),
              line: m.line_number,
              column: col + 1,
              preview: m.lines.text.replace(/\n$/, '')
            });
            if (hits.length >= max) {
              truncated = true;
              if (!killed) {
                killed = true;
                proc.kill('SIGKILL');
              }
            }
          }
        } catch {
          // partial / malformed, ignore
        }
      }
    });

    proc.stderr.setEncoding('utf-8');
    proc.stderr.on('data', (d: string) => logger.debug('rg stderr', d));

    proc.on('error', (err) => resolve({ ok: false, hits, truncated, error: err.message }));
    proc.on('close', () => resolve({ ok: true, hits, truncated }));
  });
}
