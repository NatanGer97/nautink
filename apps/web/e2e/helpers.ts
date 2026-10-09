import type { BrowserContext, Page } from '@playwright/test';

/** The `localStorage` flag that says the first-run screen was left (`first-run-store.ts`). */
const FIRST_RUN_DONE_KEY: string = 'nautink.firstRunDone';

interface StoreModule {
  useWorkspaceStore: {
    getState: () => { applyEdit: (code: string, meta: { label: string; source: string }) => void };
  };
}

/**
 * Sets the open diagram's code through the workspace store, as one history step. A stand-in for
 * typing until the code editor lands; it works because the suite runs against the dev server,
 * which serves the app's modules by path.
 */
export async function editCode(page: Page, code: string): Promise<void> {
  await page.evaluate(async (next: string) => {
    const modulePath: string = '/src/workspace/use-workspace.ts';
    const workspace: StoreModule = (await import(modulePath)) as StoreModule;
    workspace.useWorkspaceStore
      .getState()
      .applyEdit(next, { label: 'Typed in code', source: 'code' });
  }, code);
}

/** Opens every page of the context straight into the workspace, past the first-run screen. */
export async function skipFirstRun(context: BrowserContext): Promise<void> {
  await context.addInitScript((key: string) => {
    window.localStorage.setItem(key, '1');
  }, FIRST_RUN_DONE_KEY);
}
