import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

const GOOD = 'flowchart TD\n  A[Start] --> B[Done]';

/** Sets the open diagram's code through the app's own store, as one undo step. */
async function setCode(page: Page, code: string): Promise<void> {
  await page.evaluate(async (next: string) => {
    const moduleUrl = '/src/workspace/use-workspace.ts';
    const { useWorkspaceStore } = (await import(moduleUrl)) as {
      useWorkspaceStore: { getState: () => { applyEdit: (code: string, meta: object) => void } };
    };
    useWorkspaceStore.getState().applyEdit(next, { label: 'Pasted code', source: 'code' });
  }, code);
}

test.describe('preview', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('group', { name: 'Diagram preview' })).toBeVisible();
  });

  test('renders the diagram as SVG and reports it in the status bar', async ({ page }) => {
    await setCode(page, GOOD);
    const preview = page.getByRole('group', { name: 'Diagram preview' });
    await expect(preview.locator('svg')).toBeVisible();
    await expect(preview.getByText('Start', { exact: true })).toBeVisible();
    const footer = page.getByRole('contentinfo');
    await expect(footer).toContainText('Valid');
    await expect(footer).toContainText(/Rendered in \d+ ms/);
  });

  test('shows a parse error and keeps the last good render', async ({ page }) => {
    await setCode(page, GOOD);
    const preview = page.getByRole('group', { name: 'Diagram preview' });
    await expect(preview.getByText('Start', { exact: true })).toBeVisible();
    await setCode(page, `${GOOD}\n  B -->`);
    const notice = page.getByRole('region', { name: 'Parse error' });
    await expect(notice).toContainText(/Parse error on line 3/);
    await expect(notice).toContainText('Showing the last good render.');
    await expect(preview.getByText('Start', { exact: true })).toBeVisible();
    await expect(page.getByRole('contentinfo')).toContainText('Invalid');
  });

  test('zooms, fits and enters and leaves focus mode', async ({ page }) => {
    await setCode(page, GOOD);
    const toolbar = page.getByRole('toolbar', { name: 'Zoom' });
    const label = toolbar.getByText(/^\d+%$/);
    const fitted = await label.textContent();
    await toolbar.getByRole('button', { name: 'Zoom in' }).click();
    await expect(label).not.toHaveText(fitted ?? '');
    await page
      .getByRole('group', { name: 'Diagram preview' })
      .dblclick({ position: { x: 5, y: 5 } });
    await expect(label).toHaveText(fitted ?? '');
    await toolbar.getByRole('button', { name: 'Enter focus mode' }).click();
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  });
});
