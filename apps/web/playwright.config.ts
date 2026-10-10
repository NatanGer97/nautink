import { defineConfig, devices } from '@playwright/test';

// E2E_PORT lets a second checkout (a git worktree) run its suite while another dev server holds 5190.
const PORT = Number(process.env.E2E_PORT ?? 5190);
const BASE_URL = `http://localhost:${String(PORT)}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Each worker drives a browser against one shared dev server; more than 3 starved that server on a
  // 12-core laptop and tests timed out at random.
  workers: 3,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: BASE_URL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm dev --port ${String(PORT)}`,
    url: BASE_URL,
    // Always start this checkout's own server: reusing whatever holds the port once tested another
    // worktree's build. Set E2E_REUSE_SERVER=1 to run against a dev server you started yourself.
    reuseExistingServer: process.env.E2E_REUSE_SERVER === '1',
  },
});
