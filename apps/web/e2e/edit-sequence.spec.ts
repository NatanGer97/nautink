import { expect, test } from '@playwright/test';

import { centerOf, dragBy, editCode, readCode, skipFirstRun, switchView } from './helpers.ts';

import type { Locator, Page } from '@playwright/test';

const SEQUENCE: string = [
  'sequenceDiagram',
  '    participant A as Alice',
  '    participant B as Bob',
  '    participant C as Carol',
  '    A->>B: Hello',
  '    B-->>A: Hi',
  '',
].join('\n');

test.beforeEach(async ({ context }) => {
  await skipFirstRun(context);
});

function header(page: Page, id: string): Locator {
  return page.getByTestId(`sequence-participant-${id}`);
}

function row(page: Page, text: string): Locator {
  return page.locator('[data-testid^="sequence-item-"]').filter({ hasText: text });
}

async function openInEdit(page: Page, code: string = SEQUENCE): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('group', { name: 'Diagram preview' })).toBeVisible();
  await editCode(page, code);
  await switchView(page, 'Edit');
  await expect(header(page, 'A')).toBeVisible();
}

test.describe('sequence editor', () => {
  test('adds a participant, names it in place, and undo takes it back', async ({ page }) => {
    await openInEdit(page);
    await page.getByRole('button', { name: 'Add participant' }).click();
    await page.getByRole('textbox', { name: 'Participant name' }).fill('Server');
    await page.keyboard.press('Enter');
    await expect.poll(async () => readCode(page)).toContain('participant P1 as Server');
    await header(page, 'B').dblclick();
    await page.getByRole('textbox', { name: 'Participant name' }).fill('Robert');
    await page.keyboard.press('Enter');
    await expect.poll(async () => readCode(page)).toContain('participant B as Robert');
    await page.getByRole('button', { name: /^Undo/ }).first().click();
    await expect.poll(async () => readCode(page)).toContain('participant B as Bob');
  });

  test('draws a message from one lifeline to another', async ({ page }) => {
    await openInEdit(page);
    const from: Locator = page.getByTestId('sequence-lifeline-A');
    const to: { x: number; y: number } = await centerOf(page.getByTestId('sequence-lifeline-C'));
    const box: { x: number; y: number; width: number; height: number } | null =
      await from.boundingBox();
    if (box === null) {
      throw new Error('The lifeline is not on screen.');
    }
    const startY: number = box.y + box.height - 10;
    await page.mouse.move(box.x + box.width / 2, startY);
    await page.mouse.down();
    await page.mouse.move(to.x, startY, { steps: 8 });
    await page.mouse.up();
    await page.getByRole('textbox', { name: 'Message text' }).fill('Ping');
    await page.keyboard.press('Enter');
    await expect.poll(async () => readCode(page)).toContain('A->>C: Ping');
  });

  test('reorders participants by dragging a header', async ({ page }) => {
    await openInEdit(page);
    const a: { x: number; y: number } = await centerOf(header(page, 'A'));
    const c: { x: number; y: number } = await centerOf(header(page, 'C'));
    await dragBy(page, header(page, 'A'), { x: c.x - a.x + 40, y: 0 });
    await expect
      .poll(async () => readCode(page))
      .toMatch(/participant B as Bob\n\s+participant C as Carol\n\s+participant A as Alice/);
  });

  test('moves, wraps and deletes messages from the keyboard and the inspector', async ({
    page,
  }) => {
    await openInEdit(page);
    await row(page, 'Hi').click();
    await page.keyboard.press('ArrowUp');
    await expect.poll(async () => readCode(page)).toMatch(/B-->>A: Hi\n\s+A->>B: Hello/);
    const inspector: Locator = page.getByRole('region', { name: 'Inspector' });
    await inspector.getByRole('button', { name: 'Wrap in loop' }).click();
    await expect.poll(async () => readCode(page)).toMatch(/loop every second\n\s+B-->>A: Hi/);
    await expect(inspector.getByRole('heading', { name: 'Block' })).toBeVisible();
    await inspector.getByRole('button', { name: 'Unwrap' }).click();
    await expect.poll(async () => readCode(page)).not.toContain('loop');
    await row(page, 'Hello').click();
    await page.keyboard.press('Delete');
    await expect.poll(async () => readCode(page)).not.toContain('Hello');
  });

  test('drags a message below another', async ({ page }) => {
    await openInEdit(page);
    const hello: { x: number; y: number } = await centerOf(row(page, 'Hello'));
    const hi: { x: number; y: number } = await centerOf(row(page, 'Hi'));
    await dragBy(page, row(page, 'Hello'), { x: 0, y: hi.y - hello.y + 30 });
    await expect.poll(async () => readCode(page)).toMatch(/B-->>A: Hi\n\s+A->>B: Hello/);
  });

  test('adds notes, blocks from the library, and autonumber', async ({ page }) => {
    await openInEdit(page);
    await header(page, 'C').click();
    await page.getByRole('button', { name: 'Add note' }).first().click();
    await page.getByRole('textbox', { name: 'Note text' }).fill('Thinking');
    await page.keyboard.press('Enter');
    await expect.poll(async () => readCode(page)).toContain('Note right of C: Thinking');
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    const library: Locator = page.getByRole('region', { name: 'Library' });
    await library.getByRole('tab', { name: 'Blocks' }).click();
    await page.keyboard.press('Escape');
    await library.getByRole('button', { name: /^Alt/ }).click();
    await expect.poll(async () => readCode(page)).toMatch(/alt success\n\s+else failure\n\s+end/);
    await page.getByRole('button', { name: 'Number the messages (autonumber)' }).click();
    await expect.poll(async () => readCode(page)).toContain('autonumber');
  });

  test('changes a message arrow and activation in the inspector', async ({ page }) => {
    await openInEdit(page);
    await row(page, 'Hello').click();
    const inspector: Locator = page.getByRole('region', { name: 'Inspector' });
    await inspector.getByRole('button', { name: 'Async' }).click();
    await expect.poll(async () => readCode(page)).toContain('A-)B: Hello');
    await inspector.getByRole('radio', { name: 'Activate the target' }).click();
    await expect.poll(async () => readCode(page)).toContain('A-)+B: Hello');
  });

  test('fits the diagram above the prompt bar', async ({ page }) => {
    await openInEdit(page);
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Fit to view' }).click();
    const canvas: { y: number; height: number } | null = await page
      .getByTestId('sequence-canvas')
      .boundingBox();
    const footer: { y: number; height: number } | null = await page
      .getByTestId('sequence-footer-A')
      .boundingBox();
    expect(canvas).not.toBeNull();
    expect(footer).not.toBeNull();
    const promptRoom: number = 76;
    expect((footer?.y ?? 0) + (footer?.height ?? 0)).toBeLessThan(
      (canvas?.y ?? 0) + (canvas?.height ?? 0) - promptRoom,
    );
  });
});

test.describe('sequence split', () => {
  test('mirrors a selected participant between the editor and the render', async ({ page }) => {
    await openInEdit(page);
    await switchView(page, 'Split');
    const render: Locator = page.getByRole('region', { name: 'Mermaid render' });
    await expect(render.locator('svg').first()).toBeVisible();
    await header(page, 'B').click();
    await expect(render.locator('[data-canvas-selected]')).toHaveCount(1);
    // The top header carries the participant's id; the footer copy does not.
    await render.locator('g[data-et="participant"][data-id="C"]').click();
    const inspector: Locator = page.getByRole('region', { name: 'Inspector' });
    await expect(inspector.getByLabel('Id (used in code)')).toHaveValue('C');
  });
});
