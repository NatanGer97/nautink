import { expect, test } from '@playwright/test';

import { editCode } from './helpers.ts';

const TWO_BLOCKS = [
  '# Notes',
  '```mermaid',
  'pie title Traffic',
  '  "Search" : 60',
  '  "Direct" : 40',
  '```',
  '',
  '```mermaid',
  'flowchart LR',
  '  a --> b',
  '```',
  '',
].join('\n');

test('imports a Markdown file with two mermaid blocks as two diagrams', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Diagram code')).toBeVisible();
  await page.getByRole('button', { name: 'Diagrams', exact: true }).click();
  const panel = page.getByRole('complementary', { name: 'Diagrams' });
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('ControlOrMeta+k');
  await page
    .getByRole('dialog', { name: 'Command palette' })
    .getByRole('combobox')
    .fill('open file');
  await page.keyboard.press('Enter');
  await (
    await chooser
  ).setFiles({
    name: 'notes.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(TWO_BLOCKS),
  });
  await expect(page.getByText('Imported 2 diagrams')).toBeVisible();
  await expect(panel.getByRole('option')).toHaveCount(3);
  await expect(panel.getByRole('option', { name: /^notes 1, Pie/ })).toBeVisible();
  await expect(page.getByLabel('Diagram code')).toHaveText(/flowchart LR/);
});

test('backs up every diagram and restores the file into a fresh profile', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await expect(page.getByLabel('Diagram code')).toBeVisible();
  await editCode(page, 'pie title Kept\n  "a" : 1\n');
  await page.getByRole('button', { name: 'Settings' }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Back up all' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^nautink-backup-\d{4}-\d\d-\d\d\.json$/);
  const backupPath = await download.path();
  const { baseURL } = test.info().project.use;
  const fresh = await browser.newContext(baseURL === undefined ? {} : { baseURL });
  const other = await fresh.newPage();
  await other.goto('/');
  await expect(other.getByLabel('Diagram code')).toHaveText('flowchart TD');
  await other.getByRole('button', { name: 'Settings' }).click();
  const chooser = other.waitForEvent('filechooser');
  await other.getByRole('button', { name: 'Restore backup' }).click();
  await (await chooser).setFiles(backupPath);
  await expect(other.getByText('Restored 1 diagram and 0 versions')).toBeVisible();
  await expect(other.getByLabel('Diagram code')).toHaveText(/pie title Kept/);
  await fresh.close();
});
