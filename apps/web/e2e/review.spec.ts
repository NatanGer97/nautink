import { expect, test } from '@playwright/test';

import { editCode, readCode, skipFirstRun } from './helpers.ts';

import type { Locator, Page, Route } from '@playwright/test';

// Review Claude's change (PRD §4.2) and the live build (§4.3). Claude is never called: `/api/chat`
// is answered with canned SSE bodies in the server's format, as in `chat.spec.ts`.

function frame(type: string, data: Record<string, unknown>): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

function replyBody(text: string): string {
  const half = Math.floor(text.length / 2);
  return [
    frame('session', { sessionId: 'e2e-session', model: 'sonnet' }),
    frame('delta', { text: text.slice(0, half) }),
    frame('delta', { text: text.slice(half) }),
    frame('done', { sessionId: 'e2e-session', text, isError: false, durationMs: 900, costUsd: 0 }),
  ].join('');
}

function fenced(code: string): string {
  return `Here is the change.\n\`\`\`mermaid\n${code}\n\`\`\``;
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
  await expect(
    chatPanel(page).getByRole('region', { name: 'Messages' }).getByText(text),
  ).toBeVisible();
}

/** Takes the focus off any field or button, so Enter and Esc reach the review. */
async function blurFocus(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
}

async function versionCount(page: Page): Promise<string> {
  return (
    (await page
      .getByRole('contentinfo')
      .getByText(/\d+ versions?/)
      .textContent()) ?? ''
  );
}

interface ReviewCase {
  name: string;
  before: string;
  after: string;
  changes: number;
  /** A code-only type: its proposal is a diff in the code drawer. */
  isCodeOnly?: boolean;
}

const CASES: readonly ReviewCase[] = [
  {
    name: 'flowchart',
    before: 'flowchart TD\n  A[Start] --> B\n  B --> C',
    after: 'flowchart TD\n  A[Begin] --> B\n  B --> D',
    changes: 5,
  },
  {
    name: 'class',
    before: 'classDiagram\n  class Order\n  class Item\n  Order --> Item',
    after:
      'classDiagram\n  class Order {\n    +pay()\n  }\n  class Item\n  class Invoice\n  Order --> Invoice',
    changes: 4,
  },
  {
    name: 'ER',
    before: 'erDiagram\n  CUSTOMER ||--o{ ORDER : places',
    after: 'erDiagram\n  CUSTOMER ||--o{ ORDER : makes\n  ORDER ||--|{ LINE : has',
    changes: 3,
  },
  {
    name: 'state',
    before: 'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy',
    after: 'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Done : finish',
    changes: 4,
  },
  {
    name: 'sequence',
    before: 'sequenceDiagram\n  Alice->>Bob: Hi\n  Bob-->>Alice: Bye',
    after: 'sequenceDiagram\n  Alice->>Bob: Hello\n  Bob->>Carol: Ask',
    changes: 4,
  },
  {
    name: 'pie (code only)',
    before: 'pie title Pets\n  "Dogs" : 3',
    after: 'pie title Pets\n  "Dogs" : 3\n  "Cats" : 2',
    changes: 1,
    isCodeOnly: true,
  },
];

/** A cold dev server and Mermaid's first parse can be slow while workers share the machine. */
const SLOW = { timeout: 20_000 };

test.beforeEach(async ({ context, page }) => {
  await skipFirstRun(context);
  await page.goto('/');
  await expect.poll(async () => readCode(page), SLOW).toBe('flowchart TD');
});

test.describe('review Claude’s change', () => {
  for (const item of CASES) {
    test(`${item.name}: reject, show again, accept, then undo`, async ({ page }) => {
      await editCode(page, item.before);
      await cannedChat(page, [replyBody(fenced(item.after))]);
      await send(page, `Change the ${item.name}`);
      const noun = item.changes === 1 ? 'change' : 'changes';
      await expect(proposalBar(page)).toContainText(
        `Claude proposes ${String(item.changes)} ${noun}`,
        SLOW,
      );
      await expect(chatPanel(page).getByText('Waiting for your review')).toBeVisible();
      expect(await readCode(page)).toBe(item.before);
      if (item.isCodeOnly) {
        await expect(page.getByRole('region', { name: 'Proposed code changes' })).toBeVisible();
      } else {
        await expect(page.locator('[data-review]').first()).toBeAttached();
      }
      await blurFocus(page);
      await page.keyboard.press('Escape');
      await expect(proposalBar(page)).toBeHidden();
      await expect(chatPanel(page).getByText('Rejected · diagram unchanged')).toBeVisible();
      expect(await readCode(page)).toBe(item.before);
      expect(await versionCount(page)).toBe('0 versions');
      await chatPanel(page).getByRole('button', { name: 'Show again' }).click();
      await expect(proposalBar(page)).toBeVisible();
      await blurFocus(page);
      await page.keyboard.press('Enter');
      await expect.poll(async () => readCode(page)).toBe(item.after);
      await expect(chatPanel(page).getByText(`· ${String(item.changes)} ${noun}`)).toBeVisible();
      await expect.poll(async () => versionCount(page)).toBe('2 versions');
      await chatPanel(page).getByRole('button', { name: 'Undo', exact: true }).click();
      await expect.poll(async () => readCode(page)).toBe(item.before);
      await blurFocus(page);
      await page.keyboard.press('ControlOrMeta+Shift+z');
      await expect.poll(async () => readCode(page)).toBe(item.after);
    });
  }

  test('marks the proposal on the visual editor, and the buttons accept or reject', async ({
    page,
  }) => {
    const { before, after } = CASES[0]!;
    await editCode(page, before);
    await page.getByRole('banner').getByRole('radio', { name: 'Edit' }).click();
    await cannedChat(page, [replyBody(fenced(after)), replyBody(fenced(after))]);
    await send(page, 'Change it');
    await expect(proposalBar(page)).toContainText('Claude proposes 5 changes', SLOW);
    await expect(page.locator('.react-flow__node.review-added')).toHaveCount(1);
    await expect(page.locator('.react-flow__node.review-changed')).toHaveCount(1);
    await expect(page.locator('.react-flow__node.review-removed')).toHaveCount(1);
    await expect(page.locator('.react-flow__edge.review-removed')).toHaveCount(1);
    // The canvas is read-only while the proposal waits (the bar replaces the old note).
    await expect(page.getByRole('button', { name: 'Add shape' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await proposalBar(page).getByRole('button', { name: 'Reject' }).click();
    await expect(page.locator('.react-flow__node.review-removed')).toHaveCount(0);
    expect(await readCode(page)).toBe(before);
    await send(page, 'Change it again');
    await expect(proposalBar(page)).toBeVisible(SLOW);
    await proposalBar(page).getByRole('button', { name: 'Accept' }).click();
    await expect.poll(async () => readCode(page)).toBe(after);
    await expect(page.locator('.react-flow__node[class*="review-"]')).toHaveCount(0);
  });

  test('marks rows and participants on the sequence editor', async ({ page }) => {
    const { before, after } = CASES[4]!;
    await editCode(page, before);
    await page.getByRole('banner').getByRole('radio', { name: 'Edit' }).click();
    await cannedChat(page, [replyBody(fenced(after))]);
    await send(page, 'Change it');
    await expect(proposalBar(page)).toContainText('Claude proposes 4 changes', SLOW);
    await expect(page.locator('g[data-review="added"]').first()).toBeAttached();
    await expect(page.locator('g[data-review="removed"]').first()).toBeAttached();
  });

  test('a new message rejects the open proposal first', async ({ page }) => {
    const { before, after } = CASES[0]!;
    await editCode(page, before);
    const messages = await cannedChat(page, [replyBody(fenced(after)), replyBody('No change.')]);
    await send(page, 'Change it');
    await expect(proposalBar(page)).toBeVisible(SLOW);
    await send(page, 'Actually, never mind');
    await expect(proposalBar(page)).toBeHidden();
    await expect(chatPanel(page).getByText('Rejected · diagram unchanged')).toBeVisible();
    expect(await readCode(page)).toBe(before);
    expect(messages).toHaveLength(2);
  });

  test('the proposal stays with its diagram when another one is opened', async ({ page }) => {
    const { before, after } = CASES[0]!;
    await editCode(page, before);
    await cannedChat(page, [replyBody(fenced(after))]);
    await send(page, 'Change it');
    await expect(proposalBar(page)).toBeVisible(SLOW);
    await page.getByRole('button', { name: 'Diagrams', exact: true }).click();
    const panel = page.getByRole('complementary', { name: 'Diagrams' });
    await panel.getByRole('button', { name: 'New diagram' }).click();
    await expect(panel.getByRole('option')).toHaveCount(2);
    await expect(proposalBar(page)).toBeHidden();
    await expect.poll(async () => readCode(page)).toBe('flowchart TD');
    await panel.getByRole('option', { name: /^Change it/ }).click();
    await expect(proposalBar(page)).toBeVisible();
    expect(await readCode(page)).toBe(before);
  });

  test('the proposal is the code after auto-fix', async ({ page }) => {
    const { before, after } = CASES[0]!;
    await editCode(page, before);
    const messages = await cannedChat(page, [
      replyBody(fenced('flowchart TD\n  A -->')),
      replyBody(fenced(after)),
    ]);
    await send(page, 'Change it');
    await expect(proposalBar(page)).toContainText('Claude proposes 5 changes', SLOW);
    expect(messages).toHaveLength(2);
    await proposalBar(page).getByRole('button', { name: 'Accept' }).click();
    await expect.poll(async () => readCode(page)).toBe(after);
  });

  test('with review off, the reply applies straight away', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).click();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await settings.getByRole('switch', { name: 'Review changes before applying' }).click();
    await page.keyboard.press('Escape');
    const { after } = CASES[0]!;
    await cannedChat(page, [replyBody(fenced(after))]);
    await send(page, 'Change it');
    await expect.poll(async () => readCode(page), SLOW).toBe(after);
    await expect(proposalBar(page)).toBeHidden();
    await expect(chatPanel(page).getByText('Diagram updated')).toBeVisible();
  });
});
