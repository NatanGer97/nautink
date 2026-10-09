import { defineConfig, mergeConfig } from 'vitest/config';

import shared from '../../vitest.shared.config.ts';

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // Parse tests run Mermaid's own parser, which needs a DOM (DOMPurify).
      environment: 'jsdom',
      coverage: { thresholds: { lines: 100, functions: 100, statements: 100, branches: 95 } },
    },
  }),
);
