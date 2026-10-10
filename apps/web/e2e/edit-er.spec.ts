import { expect, test } from '@playwright/test';

import { centerOf, dragBy, editCode, readCode, skipFirstRun, switchView } from './helpers.ts';

import type { Locator, Page } from '@playwright/test';

const ER = [
  'erDiagram',
  '    CUSTOMER ||--o{ ORDER : places',
  '    ORDER ||--|{ LINE : contains',
  '    CUSTOMER {',
  '        int id PK',
  '        string email UK "login"',
  '    }',
  '',
].join('\n');

test.beforeEach(async ({ context }) => {
  await skipFirstRun(context);
});

function entity(page: Page, name: string): Locator {
  return page.getByTestId(`er-node-${name}`);
}

/** Waits until `locator` stops moving: the first fit animates, and starts late on a busy machine. */
async function waitUntilStill(page: Page, locator: Locator): Promise<void> {
  const settleMs: number = 150;
  await expect
    .poll(async () => {
      const before = await centerOf(locator);
      await page.waitForTimeout(settleMs);
      const after = await centerOf(locator);
      return before.x === after.x && before.y === after.y;
    })
    .toBe(true);
}

async function openInEdit(page: Page, code: string = ER): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('group', { name: 'Diagram preview' })).toBeVisible();
  await editCode(page, code);
  await switchView(page, 'Edit');
  // The editor's chunk compiles on first use, which takes a moment on a cold dev server.
  await expect(entity(page, 'CUSTOMER')).toBeVisible({ timeout: 15_000 });
  await waitUntilStill(page, entity(page, 'CUSTOMER'));
}

/** Drags from one of an entity's side handles to a point on screen. */
async function dragFromHandle(
  page: Page,
  name: string,
  to: { x: number; y: number },
): Promise<void> {
  await entity(page, name).hover();
  const from = await centerOf(entity(page, name).locator('.react-flow__handle-right'));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

test.describe('ER editor', () => {
  test('adds an entity and renames it in place, and undo takes it back', async ({ page }) => {
    await openInEdit(page);
    await page.getByRole('button', { name: 'Add entity' }).click();
    await page.keyboard.insertText('PRODUCT');
    await page.keyboard.press('Enter');
    await expect.poll(async () => readCode(page)).toContain('PRODUCT {');
    await expect(entity(page, 'PRODUCT')).toContainText('id');
    await entity(page, 'LINE').dblclick();
    await page.getByRole('textbox', { name: 'Entity name' }).fill('LINE_ITEM');
    await page.keyboard.press('Enter');
    await expect.poll(async () => readCode(page)).toContain('ORDER ||--|{ LINE_ITEM : contains');
    await page.getByRole('button', { name: /^Undo/ }).first().click();
    await expect.poll(async () => readCode(page)).toContain('ORDER ||--|{ LINE : contains');
  });

  test('edits attributes and keys in the inspector', async ({ page }) => {
    await openInEdit(page);
    await entity(page, 'CUSTOMER').click();
    const inspector = page.getByRole('region', { name: 'Inspector' });
    const email = inspector.getByRole('listitem', { name: 'Attribute email' });
    await email.getByRole('button', { name: 'Primary key' }).click();
    await expect.poll(async () => readCode(page)).toContain('string email PK, UK "login"');
    await email.getByLabel('Attribute comment').fill('sign-in address');
    await page.keyboard.press('Enter');
    await expect.poll(async () => readCode(page)).toContain('"sign-in address"');
    await inspector.getByRole('button', { name: 'Add attribute' }).click();
    await expect.poll(async () => readCode(page)).toContain('string field');
    await expect(entity(page, 'CUSTOMER')).toContainText('field');
  });

  test('relates two entities by dragging a handle, and edits the link in place', async ({
    page,
  }) => {
    await openInEdit(page);
    const line = await centerOf(entity(page, 'LINE').locator('.react-flow__handle-left'));
    await dragFromHandle(page, 'CUSTOMER', line);
    await expect.poll(async () => readCode(page)).toContain('CUSTOMER ||--o{ LINE : relates');
    const inspector = page.getByRole('region', { name: 'Inspector' });
    await expect(inspector.getByRole('heading', { name: 'Relationship' })).toBeVisible();
    await inspector
      .getByRole('group', { name: 'At CUSTOMER' })
      .getByRole('button', { name: 'Zero or one' })
      .click();
    await expect.poll(async () => readCode(page)).toContain('CUSTOMER |o--o{ LINE : relates');
    await page.getByTestId('er-label-R_ORDER_LINE_0').dblclick();
    await page.getByRole('textbox', { name: 'Relationship label' }).fill('holds');
    await page.keyboard.press('Enter');
    await expect.poll(async () => readCode(page)).toContain('ORDER ||--|{ LINE : holds');
  });

  test('makes a related entity where a link is dropped on empty canvas', async ({ page }) => {
    await openInEdit(page);
    const customer = await centerOf(entity(page, 'CUSTOMER'));
    await dragFromHandle(page, 'CUSTOMER', { x: customer.x + 320, y: customer.y - 40 });
    await expect.poll(async () => readCode(page)).toContain('CUSTOMER ||--o{ ENTITY : relates');
    await expect(entity(page, 'ENTITY')).toBeVisible({ timeout: 10_000 });
  });

  test('deletes with the keyboard and nudges with the arrows', async ({ page }) => {
    await openInEdit(page);
    await entity(page, 'CUSTOMER').click();
    const before = await centerOf(entity(page, 'CUSTOMER'));
    await page.keyboard.press('Shift+ArrowRight');
    await expect
      .poll(async () => (await centerOf(entity(page, 'CUSTOMER'))).x)
      .toBeGreaterThan(before.x + 5);
    await entity(page, 'LINE').click();
    await page.keyboard.press('Delete');
    await expect.poll(async () => readCode(page)).not.toContain('LINE');
  });

  test('keeps a dragged entity where it was left after a reload', async ({ page }) => {
    await openInEdit(page);
    await dragBy(page, entity(page, 'LINE'), { x: 260, y: 0 });
    const left =
      (await centerOf(entity(page, 'LINE'))).x - (await centerOf(entity(page, 'ORDER'))).x;
    expect(left).toBeGreaterThan(150);
    await page.waitForTimeout(600);
    await page.reload();
    await expect(entity(page, 'LINE')).toBeVisible();
    await page.waitForTimeout(400);
    const after =
      (await centerOf(entity(page, 'LINE'))).x - (await centerOf(entity(page, 'ORDER'))).x;
    expect(after).toBeGreaterThan(80);
  });

  test('mirrors the selection with the render in Split', async ({ page }) => {
    await openInEdit(page);
    await switchView(page, 'Split');
    const render = page.getByRole('region', { name: 'Mermaid render' });
    await expect(render.locator('svg').first()).toBeVisible();
    await entity(page, 'ORDER').click();
    await expect(render.locator('[data-canvas-selected]')).toHaveCount(1);
    await render.getByText('LINE', { exact: true }).click();
    const inspector = page.getByRole('region', { name: 'Inspector' });
    await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('LINE');
  });
});
