import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['aetherforge-ide/src/renderer/**/*.{ts,tsx}', 'aetherforge-ide/electron/**/*.ts'],
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
        lines: 5,
        functions: 30,
        branches: 5,
        statements: 5
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
