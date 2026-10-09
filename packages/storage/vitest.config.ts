import { defineConfig, mergeConfig } from 'vitest/config';

import shared from '../../vitest.shared.config.ts';

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // IndexedDB does not exist in Node; fake-indexeddb installs a spec-complete one globally.
      setupFiles: ['fake-indexeddb/auto'],
      // Lines at 100, not 95: `pnpm test:coverage-gate` proves the bar by adding a three-line
      // uncovered file, which a 95% bar would let through once the package is past 60 lines.
      coverage: { thresholds: { lines: 100, functions: 100, branches: 95, statements: 100 } },
    },
  }),
);
