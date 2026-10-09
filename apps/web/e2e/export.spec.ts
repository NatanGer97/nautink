import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

import { editCode, skipFirstRun } from './helpers.ts';

test.beforeEach(async ({ context }) => {
  await skipFirstRun(context);
});

test.describe('export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('contentinfo')).toContainText('Valid');
  });

  test('downloads the SVG from the menu and with ⇧⌘E', async ({ page }) => {
    await page.getByRole('button', { name: 'Export' }).click();
    const menu = page.getByRole('menu');
    const fromMenu = page.waitForEvent('download');
    await menu.getByRole('menuitem', { name: /^SVG\s*Vector/ }).click();
    const download = await fromMenu;
    expect(download.suggestedFilename()).toMatch(/\.svg$/);
    const svg = await readFile(await download.path(), 'utf8');
    expect(svg).toContain('<svg');
    await expect(page.locator('[data-sonner-toast]').first()).toContainText('Downloaded');
    const fromShortcut = page.waitForEvent('download');
    await page.keyboard.press('ControlOrMeta+Shift+E');
    expect((await fromShortcut).suggestedFilename()).toMatch(/\.svg$/);
  });

  test('downloads a PNG at the chosen scale', async ({ page }) => {
    await page.getByRole('button', { name: 'Export' }).click();
    const menu = page.getByRole('menu');
    await menu.getByRole('menuitemradio', { name: '3×' }).click();
    await expect(menu.getByText('3× resolution')).toBeVisible();
    const download = page.waitForEvent('download');
    await menu.getByRole('menuitem', { name: /^PNG/ }).click();
    expect((await download).suggestedFilename()).toMatch(/\.png$/);
  });

  test('exports the version on view, not the current code', async ({ page }) => {
    await editCode(page, 'flowchart TD\n  Old[Version one]');
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await page.keyboard.press('ControlOrMeta+s');
    await page.getByRole('dialog', { name: 'Save version' }).getByLabel('Version name').fill('One');
    await page.keyboard.press('Enter');
    await editCode(page, 'flowchart TD\n  New[Version two]');
    await page
      .getByRole('complementary', { name: 'History' })
      .getByRole('option', { name: /One$/ })
      .click();
    await expect(page.getByRole('region', { name: 'Viewed version' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Diagram preview' })).toContainText('Version one');
    const download = page.waitForEvent('download');
    await page.keyboard.press('ControlOrMeta+Shift+E');
    const svg = await readFile(await (await download).path(), 'utf8');
    expect(svg).toContain('flowchart-Old-');
    expect(svg).not.toContain('flowchart-New-');
  });
});
