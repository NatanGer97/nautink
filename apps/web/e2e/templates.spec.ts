import { expect, test } from '@playwright/test';

test('creates a diagram from a template in the gallery', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Diagram code')).toBeVisible();
  await page.getByRole('button', { name: 'Templates' }).click();
  const gallery = page.getByRole('dialog', { name: 'New diagram' });
  await gallery.getByRole('button', { name: /^Charts/ }).click();
  await expect(gallery.getByRole('article')).toHaveCount(2);
  await expect(gallery.locator('[data-state="image"]').first()).toBeVisible();
  await gallery.getByRole('button', { name: 'Use the pie chart example' }).click();
  await expect(gallery).toHaveCount(0);
  await expect(page.getByLabel('Diagram code')).toHaveText(/^pie title Traffic sources/);
  await expect(
    page.getByRole('banner').getByRole('button', { name: 'Traffic sources' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Diagrams', exact: true }).click();
  await expect(
    page.getByRole('complementary', { name: 'Diagrams' }).getByRole('option'),
  ).toHaveCount(2);
});
