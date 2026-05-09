#!/usr/bin/env node
/**
 * Idempotent postinstall: download/build native node modules so the Electron
 * runtime can `require()` them. Skipped when:
 *   - SKIP_AETHERFORGE_POSTINSTALL is set (CI / CD pipelines)
 *   - native bindings already exist
 *   - the workspace is in a fresh checkout where Electron is not yet installed
 *     (e.g. lockfile-only flows)
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

if (process.env.SKIP_AETHERFORGE_POSTINSTALL) {
  process.exit(0);
}

const electronPkg = path.join(repoRoot, 'aetherforge-ide/node_modules/electron/package.json');
if (!existsSync(electronPkg)) {
  // Electron not installed yet (e.g. CI installs only the backend workspace) — skip silently.
  process.exit(0);
}

const sqliteBinary = path.join(repoRoot, 'node_modules/better-sqlite3/build/Release/better_sqlite3.node');
if (existsSync(sqliteBinary)) {
  process.exit(0);
}

const electronVersion = JSON.parse(
  // eslint-disable-next-line n/no-sync
  (await import('node:fs')).readFileSync(electronPkg, 'utf8')
).version;

console.log(`[aetherforge] Fetching better-sqlite3 prebuilt for Electron ${electronVersion}…`);
const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['prebuild-install', '--runtime=electron', `--target=${electronVersion}`],
  {
    cwd: path.join(repoRoot, 'node_modules/better-sqlite3'),
    stdio: 'inherit'
  }
);

if (result.status !== 0) {
  console.warn(
    '[aetherforge] better-sqlite3 prebuilt not available for this Electron version; ' +
      'run `npm --workspace=aetherforge-ide run rebuild-native` manually if the IDE fails to start.'
  );
}
