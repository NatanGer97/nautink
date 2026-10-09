import { expect, test } from '@playwright/test';

test.describe('workspace', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('Diagram code')).toBeVisible();
  });

  test('starts with a blank flowchart and keeps a rename after a reload', async ({ page }) => {
    const banner = page.getByRole('banner');
    await expect(page.getByLabel('Diagram code')).toHaveText('flowchart TD');
    await banner.getByRole('button', { name: /^Flowchart · / }).click();
    await page.keyboard.type('Checkout flow');
    await page.keyboard.press('Enter');
    await expect(banner.getByRole('button', { name: 'Checkout flow' })).toBeVisible();
    await expect(banner.getByText('Saved')).toBeVisible();
    await page.reload();
    await expect(banner.getByRole('button', { name: 'Checkout flow' })).toBeVisible();
    await expect(page).toHaveTitle('Checkout flow · Nautink');
  });
});
