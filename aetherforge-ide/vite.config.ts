import path from 'node:path';
import fs from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';

// Ensures Electron treats `dist-electron/*.js` as CommonJS even though the package.json
// at the workspace root sets `"type": "module"`. Without this marker, Electron tries to
// load the bundle as ESM and fails on CJS-only deps like `electron-updater`.
function emitCjsMarker(): Plugin {
  return {
    name: 'aetherforge-emit-cjs-marker',
    apply: 'build',
    closeBundle() {
      const dir = path.resolve(__dirname, 'dist-electron');
      try {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ type: 'commonjs' }) + '\n');
      } catch {
        // best-effort
      }
    }
  };
}

const electronExternals = [
  'electron',
  'electron-log',
  'electron-updater',
  'chokidar',
  'node-pty',
  'better-sqlite3',
  '@vscode/ripgrep',
  'simple-git',
  '@sentry/electron',
  '@sentry/electron/main',
  'playwright',
  'fsevents',
  'kysely',
  // Layout libs occasionally pull `web-worker` from a Node fallback path; mark as external so
  // the Electron main bundle does not try to resolve a browser-only require at build time.
  'web-worker'
];

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ['@monaco-editor/react', 'monaco-editor'],
          reactflow: ['@xyflow/react'],
          terminal: ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-search', '@xterm/addon-web-links'],
          icons: ['lucide-react'],
          utils: ['zustand', 'clsx', 'tailwind-merge', 'localforage', 'cmdk']
        }
      }
    }
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          plugins: [
            emitCjsMarker(),
            {
              // `mergeConfig` concatenates `formats` arrays instead of replacing them, so we mutate
              // the resolved config to force CJS-only output even when the root package.json is ESM.
              name: 'aetherforge-force-cjs-main',
              config(cfg) {
                cfg.build = cfg.build ?? {};
                cfg.build.lib = {
                  entry: path.join(__dirname, 'electron/main.ts'),
                  formats: ['cjs'],
                  fileName: () => 'main.js'
                };
              }
            }
          ],
          build: {
            outDir: 'dist-electron',
            sourcemap: true,
            rollupOptions: {
              external: electronExternals,
              output: {
                inlineDynamicImports: true
              }
            }
          }
        }
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
        vite: {
          plugins: [
            {
              // Force a `.js` (CJS) preload file. The simple wrapper picks `.mjs` when the root
              // package.json is ESM; Electron then mis-parses our CJS bundle as ESM.
              name: 'aetherforge-force-cjs-preload',
              config(cfg) {
                cfg.build = cfg.build ?? {};
                cfg.build.rollupOptions = cfg.build.rollupOptions ?? {};
                cfg.build.rollupOptions.output = {
                  format: 'cjs',
                  entryFileNames: 'preload.js',
                  chunkFileNames: '[name].js',
                  assetFileNames: '[name].[ext]',
                  inlineDynamicImports: true
                };
              }
            }
          ],
          build: {
            outDir: 'dist-electron',
            sourcemap: 'inline',
            rollupOptions: {
              external: electronExternals
            }
          }
        }
      },
      renderer: {}
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  optimizeDeps: {
    exclude: ['electron']
  }
});
