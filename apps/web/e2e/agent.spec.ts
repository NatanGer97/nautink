import { expect, test } from '@playwright/test';

import { readCode, skipFirstRun } from './helpers.ts';

import type { Page, Route } from '@playwright/test';

// Codex is never called: the server's answers are canned in its own format (ADR-002).

function frame(type: string, data: Record<string, unknown>): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** A Codex reply: the whole message in one delta, and no cost. */
function codexReply(text: string): string {
  return [
    frame('session', { sessionId: 'e2e-thread', model: 'gpt-6-astra' }),
    frame('delta', { text }),
    frame('done', {
      sessionId: 'e2e-thread',
      text,
      isError: false,
      durationMs: 900,
      costUsd: null,
    }),
  ].join('');
}

const VALID = 'flowchart TD\n  Cart --> Pay\n  Pay --> Done';

const HEALTH = {
  claude: { isFound: true, version: '2.1.0', error: null },
  codex: { isFound: true, version: '0.154.0', error: null },
};

const MODELS = { claude: [], codex: [{ id: 'gpt-6-astra', label: 'GPT-6-Astra' }] };

/** Cans health, models and one chat reply, and records every chat request body. */
async function cannedServer(page: Page): Promise<Record<string, unknown>[]> {
  const requests: Record<string, unknown>[] = [];
  await page.route('**/api/health', async (route: Route) => route.fulfill({ json: HEALTH }));
  await page.route('**/api/models', async (route: Route) => route.fulfill({ json: MODELS }));
  await page.route('**/api/chat', async (route: Route) => {
    requests.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: codexReply(`Here is the diagram.\n\`\`\`mermaid\n${VALID}\n\`\`\``),
    });
  });
  return requests;
}

test.beforeEach(async ({ context }) => {
  await skipFirstRun(context);
});

test('picks Codex in Settings, chats with it, and remembers the choice', async ({ page }) => {
  const requests = await cannedServer(page);
  await page.goto('/');
  await expect.poll(async () => readCode(page)).toBe('flowchart TD');
  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByRole('radio', { name: 'Codex' }).click();
  await expect(settings.getByText('Codex CLI')).toBeVisible();
  await expect(settings.getByText('0.154.0')).toBeVisible();
  await settings.getByRole('combobox', { name: 'Default model' }).click();
  await page.getByRole('option', { name: 'GPT-6-Astra' }).click();
  await page.keyboard.press('Escape');

  const composer = page.getByLabel('Message Codex');
  await composer.fill('Draw a checkout');
  await composer.press('ControlOrMeta+Enter');
  const bar = page.getByRole('region', { name: "Codex's proposal" });
  await expect(bar).toContainText('Codex proposes');
  await expect(
    page.getByRole('complementary', { name: 'Chat' }).getByText('Codex · 0.9s'),
  ).toBeVisible();
  expect(requests[0]).toMatchObject({ agent: 'codex', model: 'gpt-6-astra', sessionId: null });

  await page.reload();
  await expect(page.getByLabel('Message Codex')).toBeVisible();
});
