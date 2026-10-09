import { expect, test } from '@playwright/test';

import { readCode } from './helpers.ts';

test('starts the first diagram from the first-run prompt', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'What do you want to diagram?' })).toBeVisible();
  await page.getByRole('radio', { name: 'Sequence' }).click();
  await page.getByLabel('Describe your diagram').fill('OAuth login with PKCE');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('complementary', { name: 'Chat' })).toBeVisible();
  await expect.poll(async () => readCode(page)).toBe('sequenceDiagram');
  await expect(page.getByRole('banner').getByText('Saved')).toBeVisible();
  await page.reload();
  await expect.poll(async () => readCode(page)).toBe('sequenceDiagram');
  await expect(page.getByRole('heading', { name: 'What do you want to diagram?' })).toHaveCount(0);
});
