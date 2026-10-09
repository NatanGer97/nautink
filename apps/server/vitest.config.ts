import { defineConfig, mergeConfig } from 'vitest/config';

import shared from '../../vitest.shared.config.ts';

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      coverage: {
        // The entry point only wires `startServer` to the process; `server.test.ts` runs it as a
        // real child process, which in-process coverage cannot see.
        exclude: ['src/main.ts'],
        // Lines at 100 so a single uncovered file fails the run (`pnpm test:coverage-gate`).
        thresholds: { lines: 100, statements: 98, functions: 95, branches: 85 },
      },
    },
  }),
);
