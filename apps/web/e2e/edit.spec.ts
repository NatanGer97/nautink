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

import type { Page } from '@playwright/test';

const FLOW = 'flowchart TD\n  A[Start] --> B[Check]\n  B --> C[Done]\n';

test.beforeEach(async ({ context }) => {
  await skipFirstRun(context);
});

async function openInEdit(page: Page, code: string = FLOW): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('group', { name: 'Diagram preview' })).toBeVisible();
  await editCode(page, code);
  await switchView(page, 'Edit');
  await expect(canvasNode(page, 'A')).toBeVisible();
  // The first fit animates for 250 ms; let it settle before measuring or dragging.
  await page.waitForTimeout(400);
}

test.describe('canvas views', () => {
  test('keeps the view on the diagram across a reload', async ({ page }) => {
    await openInEdit(page);
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Edit', exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(canvasNode(page, 'C')).toBeVisible();
  });

  test('keeps the page still while an added shape re-renders the diagram', async ({ page }) => {
    await openInEdit(page);
    // Mermaid's scratch render once made the page taller for a moment, flashing a scrollbar.
    await page.evaluate(() => {
      const record = (): void => {
        const tallest: number = Number(document.body.dataset.tallestPage ?? 0);
        const height: number = document.documentElement.scrollHeight;
        document.body.dataset.tallestPage = String(Math.max(tallest, height));
      };
      new MutationObserver(record).observe(document.body, { childList: true, subtree: true });
    });
    await page.getByRole('button', { name: 'Add shape' }).click();
    await page.keyboard.press('Escape');
    await expect.poll(async () => readCode(page)).toContain('n1');
    await page.waitForTimeout(1000);
    const tallest: string | undefined = await page.evaluate(
      () => document.body.dataset.tallestPage,
    );
    const viewport: number = await page.evaluate(() => window.innerHeight);
    expect(Number(tallest)).toBeLessThanOrEqual(viewport);
  });

  test('shows the diagram already fitted after a reload, with no jump', async ({ page }) => {
    await openInEdit(page);
    // Record the view on every frame of the reload: once the canvas shows, it must not move.
    await page.addInitScript(() => {
      const frames: string[] = [];
      Object.assign(window, { fitFrames: frames });
      const record = (): void => {
        const viewport: HTMLElement | null = document.querySelector('.react-flow__viewport');
        const hasNodes: boolean = document.querySelector('.react-flow__node') !== null;
        if (viewport !== null && hasNodes && getComputedStyle(viewport).opacity !== '0') {
          frames.push(viewport.style.transform);
        }
        requestAnimationFrame(record);
      };
      requestAnimationFrame(record);
    });
    await page.reload();
    await expect(canvasNode(page, 'A')).toBeVisible();
    await page.waitForTimeout(1500);
    const frames: string[] = await page.evaluate(
      () => (window as unknown as { fitFrames: string[] }).fitFrames,
    );
    expect(frames.length).toBeGreaterThan(0);
    expect([...new Set(frames)]).toHaveLength(1);
    expect(frames[0]).not.toBe('translate(0px, 0px) scale(1)');
  });

  test('turns Edit and Split off for a code-only type and explains why', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('group', { name: 'Diagram preview' })).toBeVisible();
    await editCode(page, 'pie title Pets\n  "Dogs" : 3\n  "Cats" : 2\n');
    const edit = page.getByRole('radio', { name: 'Edit', exact: true });
    await expect(edit).toHaveAttribute('aria-disabled', 'true');
    await edit.hover();
    await expect(page.getByRole('tooltip')).toContainText(
      "Visual editing isn't available for Pie diagrams",
    );
    await edit.click({ force: true });
    await expect(page.getByRole('group', { name: 'Diagram preview' })).toBeVisible();
  });
});

test.describe('flowchart editor', () => {
  test('adds and renames a node, and undo in the top bar takes it back', async ({ page }) => {
    await openInEdit(page);
    await page.getByRole('button', { name: 'Add shape' }).click();
    await page.keyboard.insertText('Retry');
    await page.keyboard.press('Enter');
    await expect.poll(async () => readCode(page)).toContain('n1[Retry]');
    await canvasNode(page, 'B').dblclick();
    await page.getByRole('textbox', { name: 'Node label' }).fill('Validate');
    await page.keyboard.press('Enter');
    await expect.poll(async () => readCode(page)).toContain('B[Validate]');
    await page.getByRole('button', { name: /^Undo/ }).first().click();
    await expect.poll(async () => readCode(page)).toContain('B[Check]');
    await expect(canvasNode(page, 'B')).toContainText('Check');
  });

  test('connects two nodes by dragging from a handle', async ({ page }) => {
    await openInEdit(page);
    const handle = canvasNode(page, 'A').locator('.react-flow__handle-right');
    await canvasNode(page, 'A').hover();
    const from = await centerOf(handle);
    const to = await centerOf(canvasNode(page, 'C'));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
    await expect.poll(async () => readCode(page)).toContain('A --> C');
  });

  test('keeps a dragged node where it was left after a reload', async ({ page }) => {
    await openInEdit(page);
    await dragBy(page, canvasNode(page, 'C'), { x: 160, y: 0 });
    const before = {
      a: await centerOf(canvasNode(page, 'A')),
      c: await centerOf(canvasNode(page, 'C')),
    };
    expect(before.c.x - before.a.x).toBeGreaterThan(100);
    await page.waitForTimeout(600);
    await page.reload();
    await expect(canvasNode(page, 'C')).toBeVisible();
    await page.waitForTimeout(400);
    const after = {
      a: await centerOf(canvasNode(page, 'A')),
      c: await centerOf(canvasNode(page, 'C')),
    };
    expect(Math.sign(after.c.x - after.a.x)).toBe(1);
    expect(after.c.x - after.a.x).toBeGreaterThan(50);
  });

  test('deletes the selection with the keyboard and duplicates with ⌘D', async ({ page }) => {
    await openInEdit(page);
    await canvasNode(page, 'C').click();
    await page.keyboard.press('ControlOrMeta+d');
    await expect.poll(async () => readCode(page)).toContain('n1[Done]');
    await canvasNode(page, 'B').click();
    await page.keyboard.press('Delete');
    await expect.poll(async () => readCode(page)).not.toContain('B[Check]');
  });

  test('adds an icon from the library', async ({ page }) => {
    await openInEdit(page);
    await page.getByRole('button', { name: 'Add icon' }).click();
    const library = page.getByRole('region', { name: 'Library' });
    await library.getByLabel('Search icons, e.g. aws, database, user').fill('aws');
    const aws = library.getByRole('button', { name: 'logos:aws', exact: true });
    // The pack's JSON is fetched on first use, which takes a moment under a full parallel run.
    await expect(aws).toBeVisible({ timeout: 15_000 });
    await aws.click();
    await expect.poll(async () => readCode(page)).toContain('icon: "logos:aws"');
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
    await expect(page.getByRole('button', { name: 'Add shape' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

test.describe('split', () => {
  test('mirrors the selection between the editor and the render', async ({ page }) => {
    await openInEdit(page);
    await switchView(page, 'Split');
    const render = page.getByRole('region', { name: 'Mermaid render' });
    await expect(render.locator('svg').first()).toBeVisible();
    await canvasNode(page, 'B').click();
    await expect(render.locator('[data-canvas-selected]')).toHaveCount(1);
    await render.getByText('Done', { exact: true }).click();
    const inspector = page.getByRole('region', { name: 'Inspector' });
    await expect(inspector.getByLabel('Label')).toHaveValue('Done');
    await expect(page.getByRole('region', { name: 'Code' })).toBeVisible();
  });
});
