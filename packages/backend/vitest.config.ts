import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'src/__tests__/**',
        'src/config/**',
        'src/db/index.ts',
        '**/*.d.ts',
        '**/index.ts',
      ],
      thresholds: {
        'src/services/messageOrderingService.ts': {
          statements: 85,
          branches: 85,
          functions: 85,
          lines: 85,
        },
        'src/routes/websocket.ts': {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80,
        },
        'src/routes/auth.ts': {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
