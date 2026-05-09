import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: [
        'aetherforge-ide/src/renderer/ai/usage.ts',
        'aetherforge-ide/src/renderer/ai/text-diff.ts',
        'aetherforge-ide/src/renderer/ai/dag.ts',
        'aetherforge-ide/src/renderer/ai/trace-tree.ts',
        'aetherforge-ide/src/renderer/ai/tool-schemas.ts',
        'aetherforge-ide/src/renderer/ai/rag/mention-parser.ts',
        'aetherforge-ide/src/renderer/debug/launch-config.ts',
        'aetherforge-ide/src/renderer/debug/dap-store.ts',
        'aetherforge-ide/src/renderer/plugins/marketplace/remote-index.ts',
        'aetherforge-ide/src/renderer/sync/sync-client.ts',
        'aetherforge-ide/src/renderer/state/policy-store.ts',
        'aetherforge-ide/src/renderer/auth/device-flow.ts'
      ],
      exclude: [
        'node_modules/**',
        'dist/**',
        'dist-electron/**',
        'release/**',
        '**/*.config.*',
        '**/*.d.ts',
        '**/__mocks__/**',
        'aetherforge-ide/extensions/**'
      ],
      thresholds: {
        lines: 75,
        functions: 60,
        branches: 50,
        statements: 75
      }
    },
    include: [
      'aetherforge-ide/src/**/*.test.ts',
      'aetherforge-ide/src/**/*.test.tsx',
      'aetherforge-ide/electron/**/*.test.ts',
      'packages/**/*.test.ts',
      'apps/**/*.test.ts'
    ]
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'aetherforge-ide/src')
    }
  }
});
