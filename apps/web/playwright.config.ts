import { defineConfig, devices } from '@playwright/test';

// E2E_PORT lets a second checkout (a git worktree) run its suite while another dev server holds 5190.
const PORT = Number(process.env.E2E_PORT ?? 5190);
const BASE_URL = `http://localhost:${String(PORT)}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: BASE_URL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm dev --port ${String(PORT)}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
  },
});
