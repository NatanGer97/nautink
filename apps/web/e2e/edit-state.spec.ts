import { expect, test } from '@playwright/test';

import { centerOf, dragBy, editCode, readCode, skipFirstRun, switchView } from './helpers.ts';

import type { Locator, Page } from '@playwright/test';

const STATES = [
  'stateDiagram-v2',
  '    [*] --> Idle',
  '    Idle --> Busy : start',
  '    Busy --> Done',
  '    Done --> [*]',
  '',
].join('\n');

const NESTED = [
  'stateDiagram-v2',
  '    Idle --> Active',
  '    state Active {',
  '        [*] --> Running',
  '        Running --> Paused',
  '    }',
  '',
].join('\n');

test.beforeEach(async ({ context }) => {
  await skipFirstRun(context);
});

/** A state, [*] or note on the state canvas, by its canvas id. */
function stateNode(page: Page, id: string): Locator {
  return page.getByTestId(`state-node-${id}`);
}

async function openInEdit(page: Page, code: string = STATES): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('group', { name: 'Diagram preview' })).toBeVisible();
  await editCode(page, code);
  await switchView(page, 'Edit');
  // The editor's chunk is compiled on first use, which takes a moment under a full parallel run.
  await expect(stateNode(page, 'Idle')).toBeVisible({ timeout: 15_000 });
  // The first fit animates for 250 ms; let it settle before measuring or dragging.
  await page.waitForTimeout(400);
}

async function dragLink(page: Page, from: Locator, to: { x: number; y: number }): Promise<void> {
  const start = await centerOf(from);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

test.describe('state editor', () => {
  test('adds and renames a state, and undo in the top bar takes it back', async ({ page }) => {
    await openInEdit(page);
    await page.getByRole('button', { name: 'Add state' }).click();
    await page.keyboard.insertText('Retry');
    await page.keyboard.press('Enter');
    await expect.poll(async () => readCode(page)).toMatch(/^\s+Retry$/m);
    await stateNode(page, 'Busy').dblclick();
    await page.getByRole('textbox', { name: 'State name' }).fill('Working');
    await page.keyboard.press('Enter');
    await expect.poll(async () => readCode(page)).toContain('Idle --> Working : start');
    await page.getByRole('button', { name: /^Undo/ }).first().click();
    await expect.poll(async () => readCode(page)).toContain('Idle --> Busy : start');
    await expect(stateNode(page, 'Busy')).toBeVisible();
  });

  test('connects two states by dragging from a handle, and labels the transition', async ({
    page,
  }) => {
    await openInEdit(page);
    await stateNode(page, 'Done').hover();
    await dragLink(
      page,
      stateNode(page, 'Done').locator('.react-flow__handle-left'),
      await centerOf(stateNode(page, 'Idle')),
    );
    await expect.poll(async () => readCode(page)).toContain('Done --> Idle');
    const inspector = page.getByRole('region', { name: 'Inspector' });
    await expect(inspector.getByRole('heading', { name: 'Transition' })).toBeVisible();
    await inspector.getByLabel('Label').fill('reset');
    await page.keyboard.press('Enter');
    await expect.poll(async () => readCode(page)).toContain('Done --> Idle : reset');
  });

  test('drops a transition on empty canvas to make a connected state', async ({ page }) => {
    await openInEdit(page);
    await stateNode(page, 'Done').hover();
    const done = await centerOf(stateNode(page, 'Done'));
    await dragLink(page, stateNode(page, 'Done').locator('.react-flow__handle-right'), {
      x: done.x + 220,
      y: done.y,
    });
    await page.keyboard.press('Escape');
    await expect.poll(async () => readCode(page)).toContain('Done --> State1');
  });

  test('adds a composite and a state inside it, and wraps states in a composite', async ({
    page,
  }) => {
    await openInEdit(page);
    await page.getByRole('button', { name: 'Add composite state' }).click();
    await page.keyboard.press('Escape');
    await expect.poll(async () => readCode(page)).toContain('state Composite1 {');
    const inspector = page.getByRole('region', { name: 'Inspector' });
    await inspector.getByRole('button', { name: 'Add state inside' }).click();
    await page.keyboard.press('Escape');
    await expect
      .poll(async () => readCode(page))
      .toMatch(/state Composite1 \{\n\s+State1\n\s+State2\n/);
    await stateNode(page, 'Idle').click();
    // Hold Shift before the click: React Flow reads the key from its own key-state store.
    await page.keyboard.down('Shift');
    await stateNode(page, 'Busy').click();
    await page.keyboard.up('Shift');
    await expect(inspector.getByRole('heading', { name: '2 selected' })).toBeVisible();
    await inspector.getByRole('button', { name: 'Wrap in composite' }).click();
    await expect.poll(async () => readCode(page)).toContain('state Composite2 {');
  });

  test('drops a toolbar item into a composite to nest it', async ({ page }) => {
    await openInEdit(page, NESTED);
    await page.getByRole('button', { name: 'Add choice' }).dragTo(stateNode(page, 'Active'), {
      targetPosition: { x: 12, y: 40 },
    });
    await expect.poll(async () => readCode(page)).toMatch(/state Active \{[^}]*Choice1 <<choice>>/);
  });

  test('adds notes, deletes with the keyboard and keeps a dragged state after a reload', async ({
    page,
  }) => {
    await openInEdit(page);
    await stateNode(page, 'Idle').click();
    await page.getByRole('toolbar').getByRole('button', { name: 'Add note' }).click();
    await page.getByRole('textbox', { name: 'Note text' }).fill('First');
    await page.keyboard.press('Enter');
    await expect.poll(async () => readCode(page)).toContain('note right of Idle : First');
    await stateNode(page, 'Done').click();
    await page.keyboard.press('Delete');
    await expect.poll(async () => readCode(page)).not.toContain('Done');
    await dragBy(page, stateNode(page, 'Busy'), { x: 200, y: 0 });
    const before =
      (await centerOf(stateNode(page, 'Busy'))).x - (await centerOf(stateNode(page, 'Idle'))).x;
    expect(before).toBeGreaterThan(100);
    await page.waitForTimeout(600);
    await page.reload();
    await expect(stateNode(page, 'Busy')).toBeVisible();
    await page.waitForTimeout(400);
    const after =
      (await centerOf(stateNode(page, 'Busy'))).x - (await centerOf(stateNode(page, 'Idle'))).x;
    expect(after).toBeGreaterThan(50);
  });

  test('is read-only while an older version is on view', async ({ page }) => {
    await openInEdit(page);
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await page.keyboard.press('ControlOrMeta+s');
    await page.getByRole('dialog', { name: 'Save version' }).getByLabel('Version name').fill('One');
    await page.keyboard.press('Enter');
    const panel = page.getByRole('complementary', { name: 'History' });
    await panel.getByRole('option', { name: /One$/ }).click();
    await expect(page.getByRole('region', { name: 'Viewed version' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add state' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  test('mirrors the selection between the editor and the render in Split', async ({ page }) => {
    await openInEdit(page);
    await switchView(page, 'Split');
    const render = page.getByRole('region', { name: 'Mermaid render' });
    await expect(render.locator('svg').first()).toBeVisible();
    await stateNode(page, 'Busy').click();
    await expect(render.locator('[data-canvas-selected]')).toHaveCount(1);
    await render.getByText('Done', { exact: true }).click();
    const inspector = page.getByRole('region', { name: 'Inspector' });
    await expect(inspector.getByLabel('Id')).toHaveValue('Done');
  });
});
