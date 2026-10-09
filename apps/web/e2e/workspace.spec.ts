import { expect, test } from '@playwright/test';

import { skipFirstRun } from './helpers.ts';

test.beforeEach(async ({ context }) => {
  await skipFirstRun(context);
});

test.describe('workspace', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('group', { name: 'Diagram preview' })).toBeVisible();
  });

  test('starts with a blank flowchart and keeps a rename after a reload', async ({ page }) => {
    const banner = page.getByRole('banner');
    await expect(page.getByRole('contentinfo')).toContainText('1 line');
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

test('renames the diagram in place from the command palette', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('group', { name: 'Diagram preview' })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('dialog', { name: 'Command palette' }).getByRole('combobox').fill('rename');
  await page.keyboard.press('Enter');
  const banner = page.getByRole('banner');
  await expect(banner.getByRole('textbox', { name: 'Diagram title' })).toBeFocused();
  await page.keyboard.type('Orders');
  await page.keyboard.press('Enter');
  await expect(banner.getByRole('button', { name: 'Orders' })).toBeVisible();
});

test.describe('diagrams panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Diagrams', exact: true }).click();
    await expect(page.getByRole('option')).toHaveCount(1);
  });

  test('creates, renames, searches, deletes with undo, and keeps it all after a reload', async ({
    page,
  }) => {
    const panel = page.getByRole('complementary', { name: 'Diagrams' });
    const options = panel.getByRole('option');
    await panel.getByRole('button', { name: 'New diagram' }).click();
    await expect(options).toHaveCount(2);
    await options.first().dblclick();
    await panel.getByRole('textbox', { name: 'Diagram title' }).fill('Checkout flow');
    await page.keyboard.press('Enter');
    await expect(panel.getByRole('option', { name: /^Checkout flow, Flowchart/ })).toBeVisible();
    await panel.getByRole('button', { name: 'New diagram' }).click();
    await expect(options).toHaveCount(3);
    await panel
      .getByRole('button', { name: /^Actions for Flowchart/ })
      .first()
      .click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    await expect(panel.getByRole('textbox', { name: 'Diagram title' })).toBeFocused();
    await page.keyboard.type('Orders');
    await page.keyboard.press('Enter');
    await panel.getByRole('searchbox', { name: 'Search diagrams' }).fill('checkout');
    await expect(options).toHaveCount(1);
    await panel.getByRole('searchbox', { name: 'Search diagrams' }).fill('');
    await panel.getByRole('button', { name: 'Actions for Orders' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(options).toHaveCount(2);
    await page.locator('[data-sonner-toast]').getByRole('button', { name: 'Undo' }).click();
    await expect(panel.getByRole('option', { name: /^Orders/ })).toBeVisible();
    await panel.getByRole('option', { name: /^Checkout flow/ }).click();
    await expect(
      page.getByRole('banner').getByRole('button', { name: 'Checkout flow' }),
    ).toBeVisible();
    await page.reload();
    // The open panel is a remembered preference, so the diagrams panel is back by itself.
    await expect(options).toHaveCount(3);
    await expect(panel.getByRole('option', { name: /^Checkout flow/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('moves through the list with the keyboard', async ({ page }) => {
    const panel = page.getByRole('complementary', { name: 'Diagrams' });
    await panel.getByRole('button', { name: 'New diagram' }).click();
    await expect(panel.getByRole('option')).toHaveCount(2);
    await panel.getByRole('searchbox').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(panel.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
  });
});

test('warns in both tabs when the app is open twice', async ({ context }) => {
  const first = await context.newPage();
  await first.goto('/');
  await expect(first.getByRole('group', { name: 'Diagram preview' })).toBeVisible();
  const second = await context.newPage();
  await second.goto('/');
  const warning = /open in another tab\. Edits made in both tabs overwrite each other/;
  await expect(second.getByText(warning)).toBeVisible();
  await expect(first.getByText(warning)).toBeVisible();
});
