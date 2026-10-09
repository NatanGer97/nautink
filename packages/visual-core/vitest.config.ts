import { defineConfig, mergeConfig } from 'vitest/config';

import shared from '../../vitest.shared.config.ts';

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      coverage: { thresholds: { perFile: true, lines: 90 } },
    },
  }),
);
