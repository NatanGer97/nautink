import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

import { canvasNode, setReviewChanges, skipFirstRun, switchView } from '../helpers.ts';

import type { BrowserContext, Locator, Page, Route } from '@playwright/test';

// The README screenshots: one page, scene after scene, saved as WebP in docs/screenshots/.
// Claude is never called: `/api/*` answers with canned bodies in the server's format.

const OUT_DIR: URL = new URL('../../../../docs/screenshots/', import.meta.url);
const WEBP_QUALITY: number = 0.86;
const SLOW: { timeout: number } = { timeout: 30_000 };
const SETTLE_MS: number = 600;

const CHECKOUT: string = [
  'flowchart TD',
  '  order([Customer places order]) --> stock{In stock?}',
  '  stock -->|Yes| reserve[Reserve items]',
  '  stock -->|No| notify[Notify customer]',
  '  reserve --> charge[Charge card]',
  '  charge --> paid{Payment ok?}',
  '  paid -->|Yes| ship[Ship order]',
  '  paid -->|No| notify',
  '  ship --> done([Done])',
].join('\n');

const WITH_RETRY: string = [
  'flowchart TD',
  '  order([Customer places order]) --> stock{In stock?}',
  '  stock -->|Yes| reserve[Reserve items]',
  '  stock -->|No| notify[Notify customer]',
  '  reserve --> charge[Charge card]',
  '  charge --> paid{Payment ok?}',
  '  paid -->|Yes| ship[Ship order]',
  '  paid -->|No| retry[Retry payment]',
  '  retry -->|3 failures| notify',
  '  retry --> charge',
  '  ship --> done([Done])',
].join('\n');

function frame(type: string, data: Record<string, unknown>): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** One streamed Claude reply that ends with `code` in a Mermaid fence. */
function replyBody(intro: string, code: string): string {
  const text: string = `${intro}\n\`\`\`mermaid\n${code}\n\`\`\``;
  const session: { sessionId: string } = { sessionId: 'screens' };
  return [
    frame('session', { ...session, model: 'sonnet' }),
    frame('delta', { text }),
    frame('done', { ...session, text, isError: false, durationMs: 4200, costUsd: 0 }),
  ].join('');
}

/** Answers `/api/health`, `/api/info` and each `/api/chat` with the next canned body. */
async function mockApi(page: Page, replies: string[]): Promise<void> {
  const health: object = { claude: { isFound: true, version: '2.1.0', error: null } };
  await page.route('**/api/health', async (route: Route) => route.fulfill({ json: health }));
  await page.route('**/api/info', async (route: Route) =>
    route.fulfill({ json: { repoDir: null } }),
  );
  await page.route('**/api/chat', async (route: Route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: replies.shift() ?? frame('error', { message: 'No more canned replies.' }),
    });
  });
}

function chatPanel(page: Page): Locator {
  return page.getByRole('complementary', { name: 'Chat' });
}

async function openChat(page: Page): Promise<void> {
  const button: Locator = page.getByRole('navigation', { name: 'Main' }).getByRole('button', {
    name: 'Chat',
  });
  if ((await button.getAttribute('aria-pressed')) !== 'true') {
    await button.click();
  }
  await expect(chatPanel(page)).toBeVisible();
}

async function send(page: Page, text: string): Promise<void> {
  const composer: Locator = page.getByLabel('Message Claude');
  await composer.fill(text);
  await composer.press('ControlOrMeta+Enter');
  await expect(
    chatPanel(page).getByRole('region', { name: 'Messages' }).getByText(text),
  ).toBeVisible();
}

/** Encodes a PNG screenshot as WebP with the browser's own encoder (no image tools needed). */
async function toWebp(context: BrowserContext, png: Buffer): Promise<Buffer> {
  const encoder: Page = await context.newPage();
  const dataUrl: string = await encoder.evaluate(
    async ({ source, quality }: { source: string; quality: number }) => {
      const image: HTMLImageElement = new Image();
      image.src = source;
      await image.decode();
      const canvas: HTMLCanvasElement = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext('2d')?.drawImage(image, 0, 0);
      return canvas.toDataURL('image/webp', quality);
    },
    { source: `data:image/png;base64,${png.toString('base64')}`, quality: WEBP_QUALITY },
  );
  await encoder.close();
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

async function capture(page: Page, name: string): Promise<void> {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(SETTLE_MS);
  const png: Buffer = await page.screenshot({ animations: 'disabled', caret: 'hide' });
  await writeFile(new URL(`${name}.webp`, OUT_DIR), await toWebp(page.context(), png));
}

/** Scene 1: a flowchart drawn by Claude, with the chat beside it. */
async function workspaceScene(page: Page): Promise<void> {
  await setReviewChanges(page, false);
  await openChat(page);
  await send(page, 'Draw the checkout flow for an online shop');
  await expect(chatPanel(page).getByText('Here is the checkout flow')).toBeVisible(SLOW);
  await expect(
    page.getByRole('group', { name: 'Diagram preview' }).locator('svg').first(),
  ).toBeVisible(SLOW);
  await capture(page, 'workspace');
}

/** Scene 2: the flowchart editor with a node selected and its inspector open. */
async function editScene(page: Page): Promise<void> {
  await switchView(page, 'Edit');
  await expect(canvasNode(page, 'charge')).toBeVisible(SLOW);
  await page.waitForTimeout(SETTLE_MS);
  await canvasNode(page, 'charge').click();
  await capture(page, 'edit');
}

/** Scene 3: Split, the visual editor beside the real render. */
async function splitScene(page: Page): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('button', { name: 'Chat' })
    .click();
  await switchView(page, 'Split');
  await expect(canvasNode(page, 'charge')).toBeVisible(SLOW);
  await canvasNode(page, 'charge').click();
  await capture(page, 'split');
}

/** Scene 4: Claude's change waiting for review on the canvas. */
async function reviewScene(page: Page): Promise<void> {
  await switchView(page, 'Preview');
  await setReviewChanges(page, true);
  await openChat(page);
  await send(page, 'Retry a failed payment up to three times');
  await expect(page.getByRole('region', { name: "Claude's proposal" })).toBeVisible(SLOW);
  // The fit leaves no room for the proposal bar at the top; one step out keeps the first node clear.
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await capture(page, 'review');
}

/** Scene 5: the change accepted, and the version history it left. */
async function historyScene(page: Page): Promise<void> {
  await page
    .getByRole('region', { name: "Claude's proposal" })
    .getByRole('button', { name: /^Accept/ })
    .click();
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('button', { name: 'History' })
    .click();
  await expect(page.getByRole('complementary', { name: 'History' })).toBeVisible();
  await page.getByRole('button', { name: 'Fit to view' }).click();
  await capture(page, 'history');
}

/** Scene 6: the dark theme, with the chat and the code drawer open. */
async function darkScene(page: Page): Promise<void> {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openChat(page);
  await page.getByRole('banner').getByRole('button', { name: 'Code', exact: true }).click();
  await expect(page.locator('.monaco-editor')).toBeVisible(SLOW);
  await page.getByRole('button', { name: 'Fit to view' }).click();
  await capture(page, 'dark');
}

test('README screenshots', async ({ context, page }) => {
  await skipFirstRun(context);
  await mockApi(page, [
    replyBody('Here is the checkout flow, with a stock check and a payment check.', CHECKOUT),
    replyBody('I added a retry step: three failed payments notify the customer.', WITH_RETRY),
  ]);
  await page.goto('/');
  await expect(page.getByRole('group', { name: 'Diagram preview' })).toBeVisible(SLOW);
  await workspaceScene(page);
  await editScene(page);
  await splitScene(page);
  await reviewScene(page);
  await historyScene(page);
  await darkScene(page);
});
