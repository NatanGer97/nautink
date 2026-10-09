import { expect, test } from '@playwright/test';

test.describe('app shell smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  });

  test('loads with the chat panel and the canvas', async ({ page }) => {
    await expect(page.getByRole('banner')).toContainText('Nautink');
    await expect(page.getByRole('complementary', { name: 'Chat' })).toBeVisible();
    await expect(page.getByRole('main', { name: 'Canvas' })).toBeVisible();
  });

  test('switches rail panels', async ({ page }) => {
    await page.getByRole('button', { name: 'History' }).click();
    await expect(page.getByRole('complementary', { name: 'History' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Chat' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Diagrams' }).click();
    await expect(page.getByRole('complementary', { name: 'Diagrams' })).toBeVisible();
  });

  test('opens the command palette with ⌘K and runs a command', async ({ page }) => {
    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await expect(palette).toBeVisible();
    await palette.getByRole('combobox').fill('toggle code');
    await page.keyboard.press('Enter');
    await expect(palette).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Code' })).toBeVisible();
  });

  test('toggles the theme and keeps it after a reload, with no flash', async ({ page }) => {
    const html = page.locator('html');
    await page.getByRole('button', { name: 'Settings' }).click();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await settings.getByRole('radio', { name: 'Dark' }).click();
    await expect(html).toHaveClass(/dark/);
    await expect(settings).toContainText('Not connected');
    await page.reload({ waitUntil: 'commit' });
    await expect(html).toHaveClass(/dark/);
  });
});
