import type { Page } from '@playwright/test';

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
