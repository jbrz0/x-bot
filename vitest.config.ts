import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // Use Vitest globals (describe, it, etc.) without importing
    environment: 'node', // Specify Node.js environment
    setupFiles: ['./tests/mocks/setup.ts'], // Run mock setup before tests
    // Optionally add coverage configuration
    coverage: {
      provider: 'v8', // or 'istanbul'
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'], // Files to include in coverage analysis
      exclude: [ // Files/patterns to exclude
        'src/generated/**',
        'src/config.ts',
        'src/types/**',
        'src/scheduler.ts', // Difficult to unit test cron effectively
        'src/api/**', // Vercel handler is integration-level
      ],
      thresholds: { // Optional: enforce coverage thresholds
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
  },
}); 