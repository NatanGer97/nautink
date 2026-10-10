import { expect, test } from '@playwright/test';

import { editCode, readCode, setReviewChanges, skipFirstRun, switchView } from './helpers.ts';

import type { Page } from '@playwright/test';

// Claude is never called: `/api/chat` hangs until the test lets it go, so Claude stays "working".

const FLOW = 'flowchart TD\n  A[Start] --> B[Check]\n  B --> C[Done]\n';

test.beforeEach(async ({ context }) => {
  await skipFirstRun(context);
});

/** Holds every chat request open; the returned function answers them with a short reply. */
async function holdChat(page: Page): Promise<() => void> {
  let release: () => void = () => undefined;
  const released: Promise<void> = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/chat', async (route) => {
    await released;
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: 'event: done\ndata: {"sessionId":"s","text":"OK","isError":false,"durationMs":1,"costUsd":0}\n\n',
    });
  });
  return release;
}

async function sendFromComposer(page: Page, text: string): Promise<void> {
  const composer = page.getByLabel('Message Claude');
  await composer.fill(text);
  await composer.press('ControlOrMeta+Enter');
  await expect(composer).toHaveValue('');
}

test('shows that Claude is working on the canvas and in the chat, and Stop ends it', async ({
  page,
}) => {
  await page.goto('/');
  await expect.poll(async () => readCode(page)).toBe('flowchart TD');
  await setReviewChanges(page, false);
  await editCode(page, FLOW);
  await switchView(page, 'Edit');
  await holdChat(page);
  await sendFromComposer(page, 'Add a retry step');
  const pill = page.getByRole('region', { name: 'Claude is working' });
  await expect(pill).toContainText('Claude is editing');
  await expect(pill).toContainText('Thinking…');
  await expect(page.getByRole('main', { name: 'Canvas' })).toHaveAttribute(
    'data-claude-working',
    '',
  );
  // The old one-line notice over the toolbar is gone: the pill says it.
  await expect(page.getByText('The canvas is read-only until the reply ends.')).toHaveCount(0);
  const chat = page.getByRole('complementary', { name: 'Chat' });
  await expect(chat.getByText('Thinking…')).toBeVisible();
  await pill.getByRole('button', { name: 'Stop' }).click();
  await expect(pill).toHaveCount(0);
});

test('the pill goes away when the reply ends', async ({ page }) => {
  await page.goto('/');
  await expect.poll(async () => readCode(page)).toBe('flowchart TD');
  await editCode(page, FLOW);
  const release = await holdChat(page);
  await sendFromComposer(page, 'Anything');
  const pill = page.getByRole('region', { name: 'Claude is working' });
  await expect(pill).toBeVisible();
  release();
  await expect(pill).toHaveCount(0);
});
