import { defineConfig, mergeConfig } from 'vitest/config';

import shared from '../../vitest.shared.config.ts';

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      coverage: {
        // Vendored shadcn/ui files are tested upstream; the gate covers this package's own code.
        exclude: ['src/components/**', 'src/lib/utils.ts'],
        thresholds: { perFile: true, lines: 100, functions: 100, branches: 100, statements: 100 },
      },
    },
  }),
);
