import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

import { skipFirstRun } from './helpers.ts';

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
});
