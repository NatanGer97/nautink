import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { editCode, readCode, setReviewChanges, skipFirstRun, switchView } from './helpers.ts';

import type { Locator, Page, Route } from '@playwright/test';

// Accessibility (PRD §9): axe checks every main state of the app against WCAG 2.1 AA plus the
// rules 2.2 AA adds (PRD §9 asks for 2.2), in the light and the dark theme, and the keyboard walks
// the workspace. Claude is never called: `/api` is answered here, as in `review.spec.ts`.

const WCAG_TAGS: readonly string[] = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** A cold dev server and Mermaid's first parse can be slow while workers share the machine. */
const SLOW = { timeout: 20_000 };

function frame(type: string, data: Record<string, unknown>): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

function replyBody(text: string): string {
  return [
    frame('session', { sessionId: 'e2e-session', model: 'sonnet' }),
    frame('delta', { text }),
    frame('done', { sessionId: 'e2e-session', text, isError: false, durationMs: 900, costUsd: 0 }),
  ].join('');
}

async function cannedChat(page: Page, text: string): Promise<void> {
  await page.route('**/api/chat', async (route: Route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: replyBody(text),
    });
  });
}

/** The API server is not running in the suite: answer what the shell asks for on load. */
async function cannedApi(page: Page): Promise<void> {
  await page.route('**/api/health', async (route: Route) => {
    await route.fulfill({ json: { claude: { isFound: true, version: '2.0.0', error: null } } });
  });
}

/**
 * Fails with a readable list of every violation: the rule, its impact and the elements it found.
 * Nothing is excluded: React Flow's and Monaco's DOM pass as the app configures them.
 */
async function expectNoViolations(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags([...WCAG_TAGS]).analyze();
  const report: string[] = violations.map(
    (violation) =>
      `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help}\n` +
      violation.nodes
        .map((node) => `    ${node.target.join(' ')}\n      ${node.failureSummary ?? ''}`)
        .join('\n'),
  );
  expect(report, report.join('\n\n')).toEqual([]);
}

async function openWorkspace(page: Page): Promise<void> {
  await cannedApi(page);
  await page.goto('/');
  await expect(page.getByRole('group', { name: 'Diagram preview' })).toBeVisible(SLOW);
  await expect.poll(async () => readCode(page), SLOW).toBe('flowchart TD');
}

async function openInEdit(page: Page, code: string, ready: Locator): Promise<void> {
  await openWorkspace(page);
  await editCode(page, code);
  await switchView(page, 'Edit');
  await expect(ready).toBeVisible(SLOW);
  // The first fit animates for 250 ms; let it settle so axe sees the final layout.
  await page.waitForTimeout(400);
}

function inspector(page: Page): Locator {
  return page.getByRole('region', { name: 'Inspector' });
}

const FLOW = 'flowchart TD\n  A[Start] --> B[Check]\n  B --> C[Done]\n';

const CLASSES = [
  'classDiagram',
  '    class Animal {',
  '        +String name',
  '        +speak() void',
  '    }',
  '    class Dog',
  '    Animal <|-- Dog',
  '',
].join('\n');

const ER = [
  'erDiagram',
  '    CUSTOMER ||--o{ ORDER : places',
  '    CUSTOMER {',
  '        int id PK',
  '        string email UK "login"',
  '    }',
  '',
].join('\n');

const STATES = ['stateDiagram-v2', '    [*] --> Idle', '    Idle --> Busy : start', ''].join('\n');

const SEQUENCE = [
  'sequenceDiagram',
  '    participant A as Alice',
  '    participant B as Bob',
  '    A->>B: Hello',
  '    B-->>A: Hi',
  '',
].join('\n');

interface FocusStop {
  name: string;
  /** The focus is drawn: a 2 px outline in `--ring`, or a text field's frame turning `--ring`. */
  isRingShown: boolean;
}

/**
 * Whether the focused element's focus ring is visible (PRD §9), or null when nothing has focus.
 * Buttons transition their outline, and a transition only moves on with the frames, so this looks
 * for up to half a second before it says no.
 */
async function isFocusRingShown(page: Page): Promise<boolean | null> {
  return page.evaluate(async () => {
    const element: Element | null = document.activeElement;
    if (!(element instanceof HTMLElement) || element === document.body) {
      return null;
    }
    const probe: HTMLElement = document.createElement('span');
    probe.style.color = 'var(--ring)';
    document.body.append(probe);
    const ring: string = getComputedStyle(probe).color;
    probe.remove();
    const isShown = (): boolean => {
      const style: CSSStyleDeclaration = getComputedStyle(element);
      const isOutlined: boolean =
        style.outlineStyle !== 'none' &&
        parseFloat(style.outlineWidth) >= 2 &&
        style.outlineColor === ring;
      const frame: Element | null = element.closest('[class*="focus-within:border-ring"]');
      return isOutlined || (frame !== null && getComputedStyle(frame).borderTopColor === ring);
    };
    const deadline: number = performance.now() + 500;
    while (!isShown() && performance.now() < deadline) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return isShown();
  });
}

/** What has the focus now, by its accessible name, or null when the focus is on the body. */
async function focusStop(page: Page): Promise<FocusStop | null> {
  const isRingShown: boolean | null = await isFocusRingShown(page);
  if (isRingShown === null) {
    return null;
  }
  const snapshot: string = await page.locator(':focus').ariaSnapshot();
  const name: string = /"([^"]*)"/.exec(snapshot.split('\n')[0] ?? '')?.[1] ?? snapshot;
  return { name, isRingShown };
}

/** Tabs through the page once (until the focus wraps to the body) and records every stop. */
async function tabThrough(page: Page): Promise<FocusStop[]> {
  const stops: FocusStop[] = [];
  const maxStops: number = 80;
  for (let index = 0; index < maxStops; index += 1) {
    await page.keyboard.press('Tab');
    const stop: FocusStop | null = await focusStop(page);
    if (stop === null) {
      break;
    }
    stops.push(stop);
  }
  return stops;
}

/** The workspace's main controls by the start of their name; the keyboard must reach each (PRD §9). */
const MAIN_CONTROLS: readonly string[] = [
  'Preview',
  'Code',
  'Undo',
  'Redo',
  // The shortcut follows: "Search or run… Ctrl+K".
  'Search or run…',
  'Export',
  'Diagrams',
  'Chat',
  'History',
  'Templates',
  'Settings',
  'New chat',
  'Message Claude',
  'Send',
  'Resize chat',
  'Zoom out',
  'Zoom in',
  'Fit to view',
];

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`accessibility, ${colorScheme} theme`, () => {
    test.use({ colorScheme });

    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
    });

    test('first-run screen', async ({ page }) => {
      await cannedApi(page);
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'What do you want to diagram?' })).toBeVisible(
        SLOW,
      );
      await expect(page.locator('html')).toHaveClass(
        colorScheme === 'dark' ? /dark/ : /^(?!.*dark)/,
      );
      await expectNoViolations(page);
    });

    test.describe('workspace', () => {
      test.beforeEach(async ({ context }) => {
        await skipFirstRun(context);
      });

      test('the keyboard reaches every main control, each with a visible focus ring', async ({
        page,
      }) => {
        await openWorkspace(page);
        const stops: FocusStop[] = await tabThrough(page);
        const names: string[] = stops.map((stop) => stop.name);
        const missed: string[] = MAIN_CONTROLS.filter(
          (control) => !names.some((name) => name.startsWith(control)),
        );
        expect(missed, `Tab stops: ${names.join(' | ')}`).toEqual([]);
        expect(stops.filter((stop) => !stop.isRingShown)).toEqual([]);
        // The view switch is one tab stop; the arrows move inside it (roving focus).
        await page.getByRole('radio', { name: 'Preview', exact: true }).focus();
        await page.keyboard.press('ArrowRight');
        await expect(page.getByRole('radio', { name: 'Edit', exact: true })).toBeFocused();
        await page.keyboard.press('ArrowRight');
        await expect(page.getByRole('radio', { name: 'Split', exact: true })).toBeFocused();
      });

      test('workspace with the chat panel and a conversation', async ({ page }) => {
        await openWorkspace(page);
        await setReviewChanges(page, false);
        await cannedChat(page, 'Diagrams read best when each box says one thing.');
        await page.getByLabel('Message Claude').fill('Any advice?');
        await page.getByLabel('Message Claude').press('ControlOrMeta+Enter');
        const chat = page.getByRole('complementary', { name: 'Chat' });
        await expect(chat.getByText('each box says one thing')).toBeVisible(SLOW);
        await expectNoViolations(page);
      });

      test('history panel with a saved version', async ({ page }) => {
        await openWorkspace(page);
        await page.getByRole('button', { name: 'History', exact: true }).click();
        await page.keyboard.press('ControlOrMeta+s');
        const dialog = page.getByRole('dialog', { name: 'Save version' });
        await expect(dialog).toBeVisible();
        await expectNoViolations(page);
        await dialog.getByLabel('Version name').fill('First draft');
        await page.keyboard.press('Enter');
        const panel = page.getByRole('complementary', { name: 'History' });
        await expect(panel.getByRole('option', { name: /First draft$/ })).toBeVisible();
        await expectNoViolations(page);
      });

      test('diagrams panel', async ({ page }) => {
        await openWorkspace(page);
        await page.getByRole('button', { name: 'Diagrams', exact: true }).click();
        await expect(
          page.getByRole('complementary', { name: 'Diagrams' }).getByRole('option'),
        ).toHaveCount(1);
        await expectNoViolations(page);
      });

      test('settings dialog', async ({ page }) => {
        await openWorkspace(page);
        await page.getByRole('button', { name: 'Settings' }).click();
        const settings = page.getByRole('dialog', { name: 'Settings' });
        await expect(settings).toContainText('Connected', SLOW);
        await expectNoViolations(page);
      });

      test('command palette', async ({ page }) => {
        await openWorkspace(page);
        await page.keyboard.press('ControlOrMeta+k');
        await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
        await expectNoViolations(page);
      });

      test('templates gallery', async ({ page }) => {
        await openWorkspace(page);
        await page.getByRole('button', { name: 'Templates' }).click();
        const gallery = page.getByRole('dialog', { name: 'New diagram' });
        await expect(gallery.locator('[data-state="image"]').first()).toBeVisible(SLOW);
        await expectNoViolations(page);
      });

      test('code drawer open', async ({ page }) => {
        await openWorkspace(page);
        await page.getByRole('banner').getByRole('button', { name: 'Code', exact: true }).click();
        await expect(page.locator('.monaco-editor')).toBeVisible(SLOW);
        await expectNoViolations(page);
      });

      test('split view', async ({ page }) => {
        await openWorkspace(page);
        await editCode(page, FLOW);
        await switchView(page, 'Split');
        await expect(page.getByTestId('flow-node-A')).toBeVisible(SLOW);
        await expect(page.getByRole('region', { name: 'Mermaid render' })).toBeVisible();
        await page.waitForTimeout(400);
        await expectNoViolations(page);
      });

      test('review proposal bar', async ({ page }) => {
        await openWorkspace(page);
        await editCode(page, FLOW);
        await cannedChat(
          page,
          'Here is the change.\n```mermaid\nflowchart TD\n  A[Begin] --> B[Check]\n  B --> D[Ship]\n```',
        );
        await page.getByLabel('Message Claude').fill('Change it');
        await page.getByLabel('Message Claude').press('ControlOrMeta+Enter');
        const bar = page.getByRole('region', { name: "Claude's proposal" });
        await expect(bar).toContainText('Claude proposes', SLOW);
        await expectNoViolations(page);
      });

      test('flowchart editor with a selection', async ({ page }) => {
        await openInEdit(page, FLOW, page.getByTestId('flow-node-A'));
        await page.getByTestId('flow-node-B').click();
        await expect(inspector(page).getByLabel('Label')).toHaveValue('Check');
        await expectNoViolations(page);
      });

      test('class editor with a selection', async ({ page }) => {
        await openInEdit(page, CLASSES, page.getByTestId('class-node-Animal'));
        await page.getByTestId('class-node-Animal').click();
        await expect(inspector(page)).toBeVisible();
        await expectNoViolations(page);
      });

      test('ER editor with a selection', async ({ page }) => {
        await openInEdit(page, ER, page.getByTestId('er-node-CUSTOMER'));
        await page.getByTestId('er-node-CUSTOMER').click();
        await expect(
          inspector(page).getByRole('listitem', { name: 'Attribute email' }),
        ).toBeVisible();
        await expectNoViolations(page);
      });

      test('state editor with a selection', async ({ page }) => {
        await openInEdit(page, STATES, page.getByTestId('state-node-Idle'));
        await page.getByTestId('state-node-Busy').click();
        await expect(inspector(page)).toBeVisible();
        await expectNoViolations(page);
      });

      test('sequence editor with a selection', async ({ page }) => {
        await openInEdit(page, SEQUENCE, page.getByTestId('sequence-participant-A'));
        await page.locator('[data-testid^="sequence-item-"]').filter({ hasText: 'Hi' }).click();
        await expect(inspector(page)).toBeVisible();
        await expectNoViolations(page);
      });
    });
  });
}
