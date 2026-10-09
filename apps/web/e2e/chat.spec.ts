import { expect, test } from '@playwright/test';

import type { Page, Route } from '@playwright/test';

// Claude is never called: `/api/chat` is answered with canned SSE bodies in the server's format.

function frame(type: string, data: Record<string, unknown>): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** A finished reply whose text arrives in two deltas, the second closing the diagram fence. */
function replyBody(text: string): string {
  const half = Math.floor(text.length / 2);
  return [
    frame('session', { sessionId: 'e2e-session', model: 'sonnet' }),
    frame('tool', { label: 'Read the current diagram' }),
    frame('delta', { text: text.slice(0, half) }),
    frame('delta', { text: text.slice(half) }),
    frame('done', { sessionId: 'e2e-session', text, isError: false, durationMs: 900, costUsd: 0 }),
  ].join('');
}

function fenced(code: string): string {
  return `Here is the diagram.\n\`\`\`mermaid\n${code}\n\`\`\``;
}

/** Answers each chat request with the next body, and records what was asked. */
async function cannedChat(page: Page, bodies: string[]): Promise<string[]> {
  const messages: string[] = [];
  await page.route('**/api/chat', async (route: Route) => {
    const request = route.request().postDataJSON() as { message: string };
    messages.push(request.message);
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: bodies.shift() ?? frame('error', { message: 'No more canned replies.' }),
    });
  });
  return messages;
}

async function send(page: Page, text: string): Promise<void> {
  const composer = page.getByLabel('Message Claude');
  await composer.fill(text);
  await composer.press('ControlOrMeta+Enter');
}

const VALID = 'flowchart TD\n  Cart --> Pay\n  Pay --> Done';

test.describe('chat', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('Diagram code')).toHaveText('flowchart TD');
  });

  test('streams the reply into the diagram, and one undo reverts the whole turn', async ({
    page,
  }) => {
    const messages = await cannedChat(page, [replyBody(fenced(VALID))]);
    await send(page, 'Draw a checkout');
    const chat = page.getByRole('complementary', { name: 'Chat' });
    await expect(chat.getByText('Diagram updated')).toBeVisible();
    await expect(chat.getByText('Read the current diagram')).toBeVisible();
    await expect(page.getByLabel('Diagram code')).toHaveText(VALID);
    expect(messages).toEqual(['Draw a checkout']);
    await page.getByLabel('Message Claude').blur();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.getByLabel('Diagram code')).toHaveText('flowchart TD');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(page.getByLabel('Diagram code')).toHaveText(VALID);
  });

  test('retries on its own when the reply does not parse', async ({ page }) => {
    const messages = await cannedChat(page, [
      replyBody(fenced('flowchart TD\n  Cart -->')),
      replyBody(fenced(VALID)),
    ]);
    await send(page, 'Draw a checkout');
    await expect(page.getByLabel('Diagram code')).toHaveText(VALID);
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatch(/^The diagram fails to parse:\n[\s\S]+\nFix it\.$/);
    await page.getByLabel('Message Claude').blur();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.getByLabel('Diagram code')).toHaveText('flowchart TD');
  });
});
