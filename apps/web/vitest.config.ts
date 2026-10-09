import { defineConfig, mergeConfig } from 'vitest/config';

import shared from '../../vitest.shared.config.ts';

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      coverage: {
        // The entry point only mounts <App /> into the page; the tests render <App /> directly.
        exclude: ['src/main.tsx'],
        // Not in GATED (scripts/check-coverage-gate.ts): a probe of a few lines cannot move a
        // percentage bar this size, so the bar is kept here only.
        thresholds: { lines: 70 },
      },
    },
  }),
);
