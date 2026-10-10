import { expect, test } from '@playwright/test';

import { canvasNode, editCode, readCode, skipFirstRun, switchView } from './helpers.ts';

import type { ChatRequest } from '@nautink/contracts/chat';
import type { Locator, Page, Route } from '@playwright/test';

// PRD §4.1: selection-aware prompts. Claude is never called: `/api/chat` is answered with a canned
// reply, and each request body is recorded so the test can check the selection it carried.

const FLOW = 'flowchart TD\n  A[Start] --> B[Check]\n  B --> C[Done]\n';

function frame(type: string, data: Record<string, unknown>): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

const NO_CHANGE: string = [
  frame('session', { sessionId: 'e2e-session', model: 'sonnet' }),
  frame('delta', { text: 'Nothing to change.' }),
  frame('done', {
    sessionId: 'e2e-session',
    text: 'Nothing to change.',
    isError: false,
    durationMs: 300,
    costUsd: 0,
  }),
].join('');

async function recordChat(page: Page): Promise<ChatRequest[]> {
  const requests: ChatRequest[] = [];
  await page.route('**/api/chat', async (route: Route) => {
    requests.push(route.request().postDataJSON() as ChatRequest);
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: NO_CHANGE,
    });
  });
  return requests;
}

async function openInEdit(page: Page, view: 'Edit' | 'Split' = 'Edit'): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('group', { name: 'Diagram preview' })).toBeVisible();
  await editCode(page, FLOW);
  await switchView(page, view);
  await expect(canvasNode(page, 'A')).toBeVisible();
  // The first fit animates for 250 ms; let it settle before clicking.
  await page.waitForTimeout(400);
}

/** Selects A and B: a click, then a Shift-click (React Flow reads Shift from its key store). */
async function selectAandB(page: Page): Promise<void> {
  await canvasNode(page, 'A').click();
  await page.keyboard.down('Shift');
  await canvasNode(page, 'B').click();
  await page.keyboard.up('Shift');
}

function composerChip(page: Page): Locator {
  return page.getByRole('complementary', { name: 'Chat' }).getByTestId('selection-chip');
}

async function sendFromComposer(page: Page, text: string): Promise<void> {
  const composer = page.getByLabel('Message Claude');
  await composer.fill(text);
  await composer.press('ControlOrMeta+Enter');
  await expect(composer).toHaveValue('');
  await expect(page.getByText('Nothing to change.').last()).toBeVisible();
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

test.beforeEach(async ({ context }) => {
  await skipFirstRun(context);
});

test.describe('selection-aware prompts', () => {
  test('the composer chip sends the selection, and not once removed', async ({ page }) => {
    const requests = await recordChat(page);
    await openInEdit(page);
    await selectAandB(page);
    await expect(composerChip(page)).toHaveText('2 nodes selected');
    await sendFromComposer(page, 'Make these rounded');
    expect(requests.at(-1)?.selection).toEqual({
      ids: ['A', 'B'],
      labels: ['Start', 'Check'],
      kinds: ['node', 'node'],
    });
    await composerChip(page).getByRole('button', { name: 'Remove “2 nodes selected”' }).click();
    await expect(composerChip(page)).toHaveCount(0);
    await sendFromComposer(page, 'Make everything rounded');
    expect(requests.at(-1)?.selection).toBeNull();
  });

  test('the floating prompt sits by the selection, clear of the chrome and shapes', async ({
    page,
  }) => {
    const requests = await recordChat(page);
    await openInEdit(page);
    await selectAandB(page);
    const prompt = page.getByTestId('selection-prompt');
    await expect(prompt.getByPlaceholder('Ask Claude about these 2…')).toBeVisible();
    const box = await prompt.boundingBox();
    const covered = [
      canvasNode(page, 'A'),
      canvasNode(page, 'B'),
      canvasNode(page, 'C'),
      page.getByRole('region', { name: 'Inspector' }),
      page.getByRole('toolbar', { name: 'Editor tools' }),
    ];
    for (const element of covered) {
      const other = await element.boundingBox();
      expect(box && other && overlaps(box, other)).toBe(false);
    }
    await prompt.getByRole('textbox').fill('Add a timeout between these');
    await prompt.getByRole('textbox').press('Enter');
    await expect.poll(() => requests.length).toBe(1);
    expect(requests[0]?.message).toBe('Add a timeout between these');
    expect(requests[0]?.selection?.ids).toEqual(['A', 'B']);
  });

  test('Group wraps the selection, and Esc hides the prompt', async ({ page }) => {
    await openInEdit(page);
    await selectAandB(page);
    const prompt = page.getByTestId('selection-prompt');
    await prompt.getByRole('button', { name: 'Group selection' }).click();
    await expect.poll(async () => readCode(page)).toContain('subgraph');
    await expect(composerChip(page)).toHaveText('1 group selected');
    await prompt.getByRole('textbox').click();
    await page.keyboard.press('Escape');
    await expect(prompt).toHaveCount(0);
  });

  test('works in the editor half of Split, with the chip in the prompt bar', async ({ page }) => {
    await openInEdit(page, 'Split');
    await page.getByRole('button', { name: 'Close panel' }).click();
    await canvasNode(page, 'C').click();
    const editHalf = page.getByRole('region', { name: 'Visual editor' });
    await expect(editHalf.getByTestId('selection-prompt')).toBeVisible();
    await expect(editHalf.getByPlaceholder('Ask Claude about this node…')).toBeVisible();
    const bar = page.getByLabel('Ask Claude to change this diagram').locator('..');
    await expect(bar.getByTestId('selection-chip')).toHaveText('1 node selected');
  });
});
