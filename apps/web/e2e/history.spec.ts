import { expect, test } from '@playwright/test';

import { readCode, replaceCodeInEditor, skipFirstRun } from './helpers.ts';

test.beforeEach(async ({ context }) => {
  await skipFirstRun(context);
});

test('saves a version with ⌘S, restores it, and undoes the restore', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('group', { name: 'Diagram preview' })).toBeVisible();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  const panel = page.getByRole('complementary', { name: 'History' });
  await replaceCodeInEditor(page, 'flowchart TD\n  A --> B\n');
  await page.keyboard.press('ControlOrMeta+s');
  const dialog = page.getByRole('dialog', { name: 'Save version' });
  await dialog.getByLabel('Version name').fill('First draft');
  await page.keyboard.press('Enter');
  await expect(panel.getByRole('option', { name: /^Saved, .*First draft$/ })).toBeVisible();
  await replaceCodeInEditor(page, 'flowchart TD\n  A --> C\n');
  await expect.poll(async () => readCode(page)).toMatch(/A --> C/);
  await panel.getByRole('option', { name: /First draft$/ }).click();
  const viewed = page.getByRole('region', { name: 'Viewed version' });
  await expect(viewed).toContainText('First draft');
  await expect(page.locator('.monaco-editor .view-lines')).toContainText('A --> B');
  await expect(page.getByRole('region', { name: 'Code' })).toContainText('read-only');
  await viewed.getByRole('button', { name: 'Compare with current' }).click();
  await expect(page.getByRole('region', { name: 'Changes since this version' })).toContainText(
    '+1 −1',
  );
  await viewed.getByRole('button', { name: 'Restore this version' }).click();
  await expect(viewed).toHaveCount(0);
  await expect.poll(async () => readCode(page)).toMatch(/A --> B/);
  await expect(panel.getByRole('option', { name: /^Before restore/ })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(async () => readCode(page)).toMatch(/A --> C/);
});
