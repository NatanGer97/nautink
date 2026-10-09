import { expect, test } from '@playwright/test';

import { editCode, skipFirstRun } from './helpers.ts';

test.beforeEach(async ({ context }) => {
  await skipFirstRun(context);
});

test('saves a version with ⌘S, restores it, and undoes the restore', async ({ page }) => {
  await page.goto('/');
  const code = page.getByLabel('Diagram code');
  await expect(code).toBeVisible();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  const panel = page.getByRole('complementary', { name: 'History' });
  await editCode(page, 'flowchart TD\n  A --> B\n');
  await page.keyboard.press('ControlOrMeta+s');
  const dialog = page.getByRole('dialog', { name: 'Save version' });
  await dialog.getByLabel('Version name').fill('First draft');
  await page.keyboard.press('Enter');
  await expect(panel.getByRole('option', { name: /^Saved, .*First draft$/ })).toBeVisible();
  await editCode(page, 'flowchart TD\n  A --> C\n');
  await expect(code).toHaveText(/A --> C/);
  await panel.getByRole('option', { name: /First draft$/ }).click();
  await expect(panel.getByLabel('Version code')).toHaveText(/A --> B/);
  await panel.getByRole('button', { name: 'Compare with current' }).click();
  await expect(page.getByRole('region', { name: 'Changes since this version' })).toContainText(
    '+1 −1',
  );
  await panel.getByRole('button', { name: 'Restore this version' }).click();
  await expect(code).toHaveText(/A --> B/);
  await expect(panel.getByRole('option', { name: /^Before restore/ })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(code).toHaveText(/A --> C/);
});
