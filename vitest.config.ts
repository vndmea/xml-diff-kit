import { defineConfig } from 'vitest/config';

const minCoverage = 95;

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/types.ts'],
      thresholds: {
        statements: minCoverage,
        branches: minCoverage,
        functions: minCoverage,
        lines: minCoverage,
      },
    },
  },
});
