import { defineConfig, mergeConfig } from 'vitest/config';

import shared from '../../vitest.shared.config.ts';

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // IndexedDB does not exist in Node; fake-indexeddb installs a spec-complete one globally.
      setupFiles: ['fake-indexeddb/auto'],
      coverage: { thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 } },
    },
  }),
);
