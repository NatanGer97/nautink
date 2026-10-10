import { defineConfig, mergeConfig } from 'vitest/config';

import shared from '../../vitest.shared.config.ts';

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      coverage: {
        // The entry point only wires `run` to the process, like `apps/server/src/main.ts`.
        exclude: ['src/cli.ts'],
        // 100% so a single uncovered file fails the run (`pnpm test:coverage-gate`).
        thresholds: { lines: 100, statements: 100, functions: 100, branches: 100 },
      },
    },
  }),
);
