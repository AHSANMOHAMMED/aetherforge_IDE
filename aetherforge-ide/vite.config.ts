import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';

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
  'kysely'
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
          build: {
            outDir: 'dist-electron',
            sourcemap: true,
            rollupOptions: {
              external: electronExternals,
              output: {
                entryFileNames: 'main.js'
              }
            }
          }
        }
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
        vite: {
          build: {
            outDir: 'dist-electron',
            sourcemap: 'inline',
            rollupOptions: {
              external: electronExternals,
              output: {
                entryFileNames: 'preload.js'
              }
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
