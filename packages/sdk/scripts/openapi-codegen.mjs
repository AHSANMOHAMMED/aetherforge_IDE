#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outFile = join(root, 'src', 'generated', 'api.ts');
const base = process.env.OPENAPI_URL ?? 'http://127.0.0.1:8787/v1/openapi.json';

const res = await fetch(base);
if (!res.ok) {
  console.error('openapi:codegen: failed to fetch', base, res.status);
  process.exit(1);
}
const json = await res.json();
const tmp = join(root, '.openapi-tmp.json');
mkdirSync(dirname(tmp), { recursive: true });
writeFileSync(tmp, JSON.stringify(json));

const r = spawnSync('npx', ['openapi-typescript', tmp, '-o', outFile], { stdio: 'inherit', cwd: root });
process.exit(r.status ?? 1);
