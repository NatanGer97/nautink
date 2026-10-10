import { expect, test } from '@playwright/test';

import {
  canvasNode,
  centerOf,
  dragBy,
  editCode,
  readCode,
  skipFirstRun,
  switchView,
} from './helpers.ts';

import type { Locator, Page } from '@playwright/test';

const CLASSES = `classDiagram
    class Animal {
        +String name
        +speak() void
    }
    class Dog
    class Cat
    Animal <|-- Dog
`;

test.beforeEach(async ({ context }) => {
  await skipFirstRun(context);
});

function classNode(page: Page, id: string): Locator {
  return page.getByTestId(`class-node-${id}`);
}

async function openInEdit(page: Page, code: string = CLASSES): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('group', { name: 'Diagram preview' })).toBeVisible();
  await editCode(page, code);
  await switchView(page, 'Edit');
  await expect(classNode(page, 'Animal')).toBeVisible();
  // The first fit animates for 250 ms; let it settle before measuring or dragging.
  await page.waitForTimeout(400);
}

/** Drags from one point to another in small steps, so React Flow sees a connection drag. */
async function dragLine(page: Page, from: Locator, to: { x: number; y: number }): Promise<void> {
  const start: { x: number; y: number } = await centerOf(from);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

test.describe('class editor', () => {
  test('adds an interface, renames it in place, and undo takes it back', async ({ page }) => {
    await openInEdit(page);
    await page.getByRole('button', { name: 'Add interface', exact: true }).click();
    await page.getByRole('textbox', { name: 'Class name' }).fill('Pet');
    await page.keyboard.press('Enter');
    await expect.poll(async () => readCode(page)).toContain('class Pet');
    await expect.poll(async () => readCode(page)).toContain('<<interface>>');
    await page.getByRole('button', { name: /^Undo/ }).first().click();
    await expect.poll(async () => readCode(page)).toContain('Interface1');
  });

  test('edits a member in place and in the inspector', async ({ page }) => {
    await openInEdit(page);
    await classNode(page, 'Animal').getByText('String name').dblclick();
    await page.getByRole('textbox', { name: 'Attribute', exact: true }).fill('-int age');
    await page.keyboard.press('Enter');
    await expect.poll(async () => readCode(page)).toContain('-int age');
    const inspector = page.getByRole('region', { name: 'Inspector' });
    await inspector.getByRole('button', { name: 'Static method 1' }).click();
    await expect.poll(async () => readCode(page)).toContain('+speak()$ void');
    await inspector.getByRole('button', { name: 'Method', exact: true }).click();
    await expect.poll(async () => readCode(page)).toContain('+method()');
  });

  test('connects two classes with the chosen relation kind by dragging a handle', async ({
    page,
  }) => {
    await openInEdit(page);
    await page.getByRole('combobox', { name: 'Relation kind for new links' }).click();
    await page.getByRole('option', { name: /^Composition/ }).click();
    await classNode(page, 'Dog').hover();
    await dragLine(
      page,
      classNode(page, 'Dog').locator('.react-flow__handle-right'),
      await centerOf(classNode(page, 'Cat')),
    );
    await expect.poll(async () => readCode(page)).toContain('Dog *-- Cat');
  });

  test('drops a link on empty canvas for a new linked class', async ({ page }) => {
    await openInEdit(page);
    await classNode(page, 'Cat').hover();
    const handle: Locator = classNode(page, 'Cat').locator('.react-flow__handle-bottom');
    const start: { x: number; y: number } = await centerOf(handle);
    await dragLine(page, handle, { x: start.x, y: start.y + 160 });
    await expect.poll(async () => readCode(page)).toContain('Cat --> Class1');
  });

  test('deletes with the keyboard and duplicates with ⌘D', async ({ page }) => {
    await openInEdit(page);
    await classNode(page, 'Animal').click();
    await page.keyboard.press('ControlOrMeta+d');
    await expect.poll(async () => readCode(page)).toContain('class Animal1');
    await classNode(page, 'Cat').click();
    await page.keyboard.press('Delete');
    await expect.poll(async () => readCode(page)).not.toContain('Cat');
  });

  test('groups classes in a namespace and drags the frame with them', async ({ page }) => {
    await openInEdit(page);
    await classNode(page, 'Dog').click();
    await classNode(page, 'Cat').click({ modifiers: ['Shift'] });
    await page
      .getByRole('region', { name: 'Inspector' })
      .getByRole('button', { name: 'Group in namespace' })
      .click();
    await expect.poll(async () => readCode(page)).toContain('namespace Namespace1');
    const frame: Locator = page.getByTestId('class-namespace-Namespace1');
    const before: { x: number; y: number } = await centerOf(classNode(page, 'Dog'));
    const title: { x: number; y: number } = await centerOf(frame.getByText('namespace'));
    await page.mouse.move(title.x, title.y);
    await page.mouse.down();
    await page.mouse.move(title.x + 120, title.y + 40, { steps: 8 });
    await page.mouse.up();
    const after: { x: number; y: number } = await centerOf(classNode(page, 'Dog'));
    expect(after.x - before.x).toBeGreaterThan(80);
  });

  test('keeps a dragged class where it was left after a reload', async ({ page }) => {
    await openInEdit(page);
    await dragBy(page, classNode(page, 'Cat'), { x: 220, y: 0 });
    const gap = async (): Promise<number> =>
      (await centerOf(classNode(page, 'Cat'))).x - (await centerOf(classNode(page, 'Animal'))).x;
    expect(await gap()).toBeGreaterThan(150);
    await page.waitForTimeout(600);
    await page.reload();
    await expect(classNode(page, 'Cat')).toBeVisible();
    await page.waitForTimeout(400);
    expect(await gap()).toBeGreaterThan(60);
  });

  test('mirrors the selection with the render in Split', async ({ page }) => {
    await openInEdit(page);
    await switchView(page, 'Split');
    const render: Locator = page.getByRole('region', { name: 'Mermaid render' });
    await expect(render.locator('svg').first()).toBeVisible();
    await classNode(page, 'Dog').click();
    await expect(render.locator('[data-canvas-selected]')).toHaveCount(1);
    await render.getByText('Cat', { exact: true }).click();
    const inspector: Locator = page.getByRole('region', { name: 'Inspector' });
    await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('Cat');
  });
});

// The library preference is the viewer's, not the diagram's; only the flowchart has a library.
test.describe('library open state', () => {
  test('stays open across a reload once opened', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('group', { name: 'Diagram preview' })).toBeVisible();
    await editCode(page, 'flowchart TD\n  A[Start] --> B[Done]\n');
    await switchView(page, 'Edit');
    await expect(canvasNode(page, 'A')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Library' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Library' })).toBeVisible();
    await page.reload();
    await expect(canvasNode(page, 'A')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Library' })).toBeVisible();
    await page.getByRole('button', { name: 'Close library' }).click();
    await page.reload();
    await expect(canvasNode(page, 'A')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Library' })).toHaveCount(0);
  });
});
