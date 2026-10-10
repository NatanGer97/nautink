import { expect, test } from '@playwright/test';

import { canvasNode, editCode, readCode, skipFirstRun, switchView } from './helpers.ts';

import type { ChatRequest } from '@nautink/contracts/chat';
import type { Locator, Page, Route } from '@playwright/test';

// Wave 6A polish: undo during a review, a reply's diff, quick actions with the selection, code
// colors in dark mode, state descriptions, the bulk inspector, narrow Split and fitting below the
// proposal bar. Claude is never called: `/api/chat` gets canned SSE bodies, as in `review.spec.ts`.

type Box = { x: number; y: number; width: number; height: number };

const SLOW = { timeout: 20_000 };

function frame(type: string, data: Record<string, unknown>): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

function replyBody(text: string): string {
  return [
    frame('session', { sessionId: 'e2e-session', model: 'sonnet' }),
    frame('delta', { text }),
    frame('done', { sessionId: 'e2e-session', text, isError: false, durationMs: 300, costUsd: 0 }),
  ].join('');
}

function fenced(code: string): string {
  return `Here is the change.\n\`\`\`mermaid\n${code}\n\`\`\``;
}

/** Answers each chat request with the next body (then "no change"), and records the requests. */
async function cannedChat(page: Page, bodies: string[]): Promise<ChatRequest[]> {
  const requests: ChatRequest[] = [];
  await page.route('**/api/chat', async (route: Route) => {
    requests.push(route.request().postDataJSON() as ChatRequest);
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: bodies.shift() ?? replyBody('Nothing to change.'),
    });
  });
  return requests;
}

function chatPanel(page: Page): Locator {
  return page.getByRole('complementary', { name: 'Chat' });
}

function proposalBar(page: Page): Locator {
  return page.getByRole('region', { name: "Claude's proposal" });
}

async function send(page: Page, text: string): Promise<void> {
  const composer = page.getByLabel('Message Claude');
  await composer.fill(text);
  await expect(page.getByRole('button', { name: 'Send' })).not.toHaveAttribute('aria-disabled');
  await composer.press('ControlOrMeta+Enter');
}

async function blurFocus(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
}

async function boxOf(locator: Locator): Promise<Box> {
  const box: Box | null = await locator.boundingBox();
  if (box === null) {
    throw new Error('The element is not on screen.');
  }
  return box;
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function openInEdit(
  page: Page,
  code: string,
  view: 'Edit' | 'Split' = 'Edit',
): Promise<void> {
  await editCode(page, code);
  await switchView(page, view);
  // The first fit animates for 250 ms; let it settle before clicking.
  await page.waitForTimeout(400);
}

const BEFORE = 'flowchart TD\n  A[Start] --> B\n  B --> C';
const AFTER = 'flowchart TD\n  A[Begin] --> B\n  B --> D';
const FLOW = 'flowchart TD\n  A[Start] --> B[Check]\n  B --> C[Done]';

test.beforeEach(async ({ context, page }) => {
  await skipFirstRun(context);
  await page.goto('/');
  await expect.poll(async () => readCode(page), SLOW).toBe('flowchart TD');
});

test('undo rejects an open proposal instead of changing the code under it', async ({ page }) => {
  await editCode(page, BEFORE);
  await cannedChat(page, [replyBody(fenced(AFTER))]);
  await send(page, 'Change it');
  await expect(proposalBar(page)).toContainText('Claude proposes', SLOW);
  const banner = page.getByRole('banner');
  await expect(banner.getByRole('button', { name: 'Redo' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await banner.getByRole('button', { name: "Undo: Reject Claude's change" }).click();
  await expect(proposalBar(page)).toBeHidden();
  await expect(chatPanel(page).getByText('Rejected · diagram unchanged')).toBeVisible();
  expect(await readCode(page)).toBe(BEFORE);
  await chatPanel(page).getByRole('button', { name: 'Show again' }).click();
  await expect(proposalBar(page)).toBeVisible();
  await blurFocus(page);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(proposalBar(page)).toBeHidden();
  expect(await readCode(page)).toBe(BEFORE);
});

test("opens an accepted reply's diff in the code drawer from its card", async ({ page }) => {
  await editCode(page, BEFORE);
  await cannedChat(page, [replyBody(fenced(AFTER))]);
  await send(page, 'Change it');
  await proposalBar(page).getByRole('button', { name: 'Accept' }).click(SLOW);
  await expect.poll(async () => readCode(page)).toBe(AFTER);
  await chatPanel(page).getByRole('button', { name: 'Diff', exact: true }).click();
  const drawer = page.getByRole('region', { name: 'Code' });
  const diff = drawer.getByRole('region', { name: 'Code changes from this reply' });
  await expect(diff).toBeVisible();
  await expect(diff.locator('.monaco-diff-editor')).toBeVisible(SLOW);
  await drawer.getByRole('button', { name: 'Back to code' }).click();
  await expect(diff).toBeHidden();
  await expect(drawer.locator('.monaco-editor').first()).toBeVisible();
});

test('quick actions send the canvas selection while its chip shows', async ({ page }) => {
  const requests = await cannedChat(page, []);
  await openInEdit(page, FLOW);
  await canvasNode(page, 'A').click();
  await page.keyboard.down('Shift');
  await canvasNode(page, 'B').click();
  await page.keyboard.up('Shift');
  await expect(chatPanel(page).getByTestId('selection-chip')).toHaveText('2 nodes selected');
  await chatPanel(page)
    .getByRole('group', { name: 'Quick actions' })
    .getByRole('button', { name: 'Explain' })
    .click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]?.selection?.ids).toEqual(['A', 'B']);
});

test('tones down code colors in dark mode so labels stay readable', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('dialog', { name: 'Settings' }).getByRole('radio', { name: 'Dark' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await openInEdit(
    page,
    'sequenceDiagram\n  participant A\n  rect rgb(255, 255, 255)\n    A->>B: Hello\n  end',
  );
  const rect = page.locator('rect[fill="rgb(255, 255, 255)"]');
  await expect(rect).toBeAttached(SLOW);
  expect(await rect.evaluate((element) => getComputedStyle(element).fillOpacity)).toBe('0.12');
  await openInEdit(page, 'classDiagram\n  class Order\n  style Order fill:#ffffff,color:#000000');
  const order = page.getByTestId('class-node-Order');
  await expect(order).toBeVisible(SLOW);
  const colors = await order.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, text: style.color };
  });
  expect(colors.background).not.toBe('rgb(255, 255, 255)');
  expect(colors.text).toBe('rgb(237, 237, 235)');
});

test('shows `Id : text` as a state description, and keeps it a description', async ({ page }) => {
  await openInEdit(page, 'stateDiagram-v2\n  [*] --> Idle\n  Idle : Waiting for work');
  const idle = page.getByTestId('state-node-Idle');
  await expect(idle).toContainText('Idle', SLOW);
  await expect(idle).toContainText('Waiting for work');
  await idle.click();
  const inspector = page.getByRole('region', { name: 'Inspector' });
  await expect(inspector.getByLabel('Description')).toHaveValue('Waiting for work');
  await expect(inspector.getByLabel('Display name')).toHaveValue('');
  expect(await readCode(page)).toContain('Idle : Waiting for work');
});

test('gives several selected nodes one shape from the bulk inspector', async ({ page }) => {
  await openInEdit(page, FLOW);
  await canvasNode(page, 'A').click();
  await page.keyboard.down('Shift');
  await canvasNode(page, 'C').click();
  await page.keyboard.up('Shift');
  const inspector = page.getByRole('region', { name: 'Inspector' });
  await expect(inspector.getByRole('heading', { name: '2 nodes' })).toBeVisible();
  await inspector.getByRole('button', { name: 'Circle' }).click();
  await expect.poll(async () => readCode(page)).toContain('A((Start))');
  expect(await readCode(page)).toContain('C((Done))');
  await expect(inspector.getByRole('button', { name: 'Group' })).toBeVisible();
});

test('keeps the inspector off the zoom bar in a narrow Split', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 560 });
  await openInEdit(page, FLOW, 'Split');
  await canvasNode(page, 'A').click();
  await page.keyboard.down('Shift');
  await canvasNode(page, 'B').click();
  await page.keyboard.up('Shift');
  const editor = page.locator('.nautink-flow');
  expect((await boxOf(editor)).width).toBeLessThan(640);
  const inspector = await boxOf(page.getByRole('region', { name: 'Inspector' }));
  const zoom = await boxOf(editor.getByRole('toolbar', { name: 'Zoom' }));
  expect(overlaps(inspector, zoom)).toBe(false);
});

test("fits the preview below Claude's proposal bar", async ({ page }) => {
  const tall = 'flowchart TD\n  A --> B\n  B --> C\n  C --> D\n  D --> E\n  E --> F';
  await editCode(page, tall);
  await cannedChat(page, [replyBody(fenced(`${tall}\n  F --> G`))]);
  await send(page, 'Add G');
  await expect(proposalBar(page)).toContainText('Claude proposes', SLOW);
  const bar = await boxOf(proposalBar(page));
  const stage = page.getByRole('group', { name: 'Diagram preview' });
  await expect
    .poll(async () => (await boxOf(stage.locator('svg .node').first())).y, SLOW)
    .toBeGreaterThanOrEqual(bar.y + bar.height);
});
