import { expect, test } from '@playwright/test';

import { focusCodeEditor, pressInEditor, skipFirstRun } from './helpers.ts';

import type { Page } from '@playwright/test';

/** Opens the code drawer and puts the cursor at the end of the code. */
async function openCodeAtEnd(page: Page): Promise<void> {
  await focusCodeEditor(page);
  await pressInEditor(page, 'End');
}

test.beforeEach(async ({ context }) => {
  await skipFirstRun(context);
});

test.describe('code drawer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('group', { name: 'Diagram preview' })).toBeVisible();
  });

  test('typing updates the preview, and ⌘Z reverts it', async ({ page }) => {
    await openCodeAtEnd(page);
    await page.keyboard.type('  A[Typed node]');
    const preview = page.getByRole('group', { name: 'Diagram preview' });
    await expect(preview.getByText('Typed node', { exact: true })).toBeVisible();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(preview.getByText('Typed node', { exact: true })).toHaveCount(0);
    await expect(page.locator('.monaco-editor .view-lines')).not.toContainText('Typed node');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(preview.getByText('Typed node', { exact: true })).toBeVisible();
  });

  test('an invalid edit marks the line, keeps the last render and offers a fix', async ({
    page,
  }) => {
    await openCodeAtEnd(page);
    await page.keyboard.type('  A[Kept] --> B');
    const preview = page.getByRole('group', { name: 'Diagram preview' });
    await expect(preview.getByText('Kept', { exact: true })).toBeVisible();
    await page.keyboard.type(' -->');
    await expect(page.getByRole('region', { name: 'Parse error' })).toContainText('line 2');
    await expect(preview.getByText('Kept', { exact: true })).toBeVisible();
    const drawer = page.getByRole('region', { name: 'Code' });
    await expect(drawer.getByText('Parse error on line 2')).toBeVisible();
    await expect(page.locator('.monaco-editor .squiggly-error')).toHaveCount(1);
    await page.evaluate(() => {
      window.addEventListener('nautink:ask-claude-to-fix', (event) => {
        document.body.dataset.askedFixLine = String(
          (event as CustomEvent<{ line: number }>).detail.line,
        );
      });
    });
    await drawer.getByRole('button', { name: 'Ask Claude to fix' }).click();
    await expect(page.locator('body')).toHaveAttribute('data-asked-fix-line', '2');
  });

  test('clicking a shape on the canvas selects its line in the code', async ({ page }) => {
    await openCodeAtEnd(page);
    await page.keyboard.type('  A[Start] --- B[Retry]\n  C[Other]');
    const drawer = page.getByRole('region', { name: 'Code' });
    await drawer.getByRole('button', { name: 'Close code' }).click();
    await expect(drawer).toHaveCount(0);
    const preview = page.getByRole('group', { name: 'Diagram preview' });
    await preview.getByText('Other', { exact: true }).click();
    await expect(drawer.getByText(/^Ln 3, Col \d+$/)).toBeVisible();
    await expect(page.locator('.monaco-editor .selected-text')).not.toHaveCount(0);
  });
});
