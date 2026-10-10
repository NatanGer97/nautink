import { defineConfig, devices } from '@playwright/test';

// The README screenshots (docs/screenshots/). Not part of `test:e2e`: the default config only runs
// `*.spec.ts` files, and this one only runs `*.screens.ts`. `/api/*` is mocked, so no Claude is needed.
//
//   pnpm --filter @nautink/web exec playwright test --config e2e/screenshots/playwright.config.ts
const PORT = Number(process.env.E2E_PORT ?? 5473);
const BASE_URL = `http://localhost:${String(PORT)}`;

export default defineConfig({
  testDir: '.',
  testMatch: '*.screens.ts',
  // One worker: the scenes build on each other in one page, and timing jitter shows in pictures.
  workers: 1,
  timeout: 120_000,
  reporter: 'list',
  outputDir: '../../test-results/screenshots',
  use: {
    baseURL: BASE_URL,
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  },
  webServer: {
    command: `pnpm dev --port ${String(PORT)}`,
    url: BASE_URL,
    reuseExistingServer: process.env.E2E_REUSE_SERVER === '1',
  },
});
