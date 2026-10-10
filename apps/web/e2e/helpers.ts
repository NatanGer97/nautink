import { expect } from '@playwright/test';

import type { BrowserContext, Locator, Page } from '@playwright/test';

/** The `localStorage` flag that says the first-run screen was left (`first-run-store.ts`). */
const FIRST_RUN_DONE_KEY: string = 'nautink.firstRunDone';

interface StoreState {
  applyEdit: (code: string, meta: { label: string; source: string }) => void;
  activeId: string | null;
  diagrams: readonly { id: string; code: string }[];
}

interface StoreModule {
  useWorkspaceStore: { getState: () => StoreState };
}

/**
 * The open diagram's code, trimmed, read from the workspace store. Use it with `expect.poll`:
 * the canvas shows the rendered diagram, not the code text.
 */
export async function readCode(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const modulePath: string = '/src/workspace/use-workspace.ts';
    const workspace: StoreModule = (await import(modulePath)) as StoreModule;
    const state: StoreState = workspace.useWorkspaceStore.getState();
    return (state.diagrams.find((diagram) => diagram.id === state.activeId)?.code ?? '').trim();
  });
}

/**
 * Sets the open diagram's code through the workspace store, as one history step, without the code
 * editor. Prefer `replaceCodeInEditor` where typing matters; this works because the suite runs
 * against the dev server, which serves the app's modules by path.
 */
export async function editCode(page: Page, code: string): Promise<void> {
  await page.evaluate(async (next: string) => {
    const modulePath: string = '/src/workspace/use-workspace.ts';
    const workspace: StoreModule = (await import(modulePath)) as StoreModule;
    workspace.useWorkspaceStore
      .getState()
      .applyEdit(next, { label: 'Typed in code', source: 'code' });
  }, code);
}

interface UiStoreModule {
  useUiStore: { getState: () => { setReviewChanges: (isOn: boolean) => void } };
}

/**
 * Turns "Review changes before applying" on or off through the UI store (it is on by default), so a
 * spec about something else can have Claude's replies apply straight away.
 */
export async function setReviewChanges(page: Page, isOn: boolean): Promise<void> {
  await page.evaluate(async (isWanted: boolean) => {
    const modulePath: string = '/src/state/ui-store.ts';
    const ui: UiStoreModule = (await import(modulePath)) as UiStoreModule;
    ui.useUiStore.getState().setReviewChanges(isWanted);
  }, isOn);
}

/** Opens every page of the context straight into the workspace, past the first-run screen. */
export async function skipFirstRun(context: BrowserContext): Promise<void> {
  await context.addInitScript((key: string) => {
    window.localStorage.setItem(key, '1');
  }, FIRST_RUN_DONE_KEY);
}

/** Opens the code drawer (when closed) and puts the cursor in the editor. */
export async function focusCodeEditor(page: Page): Promise<void> {
  const codeButton: Locator = page
    .getByRole('banner')
    .getByRole('button', { name: 'Code', exact: true });
  if ((await codeButton.getAttribute('aria-pressed')) !== 'true') {
    await codeButton.click();
  }
  const editor: Locator = page.locator('.monaco-editor');
  await expect(editor).toBeVisible();
  await editor.locator('.view-lines').click();
}

/**
 * Presses `key` with the modifier Monaco expects. Monaco picks ⌘ or Ctrl from the user agent, and
 * the suite's "Desktop Chrome" device reports Windows even on a Mac, so `ControlOrMeta` can miss.
 */
export async function pressInEditor(page: Page, key: string): Promise<void> {
  const isMacAgent: boolean = await page.evaluate(() => /Mac/i.test(navigator.userAgent));
  await page.keyboard.press(`${isMacAgent ? 'Meta' : 'Control'}+${key}`);
}

/**
 * Replaces the code in the Monaco editor, as text input (not a paste): select it all, then insert.
 * Text is inserted rather than typed key by key, so auto-indent, auto-closing brackets and the
 * suggestion list do not change it.
 */
export async function replaceCodeInEditor(page: Page, code: string): Promise<void> {
  await focusCodeEditor(page);
  await pressInEditor(page, 'a');
  await page.keyboard.insertText(code);
}

/** Switches the open diagram to Preview, Edit or Split with the top bar's segmented control. */
export async function switchView(page: Page, view: 'Preview' | 'Edit' | 'Split'): Promise<void> {
  await page.getByRole('radio', { name: view, exact: true }).click();
  await expect(page.getByRole('radio', { name: view, exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
}

/** A node on the visual editor's canvas, by its Mermaid id. */
export function canvasNode(page: Page, id: string): Locator {
  return page.getByTestId(`flow-node-${id}`);
}

/** The middle of an element on screen. Throws when it is not on screen. */
export async function centerOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box: { x: number; y: number; width: number; height: number } | null =
    await locator.boundingBox();
  if (box === null) {
    throw new Error('Cannot find the middle of an element that is not on screen.');
  }
  const half: number = 0.5;
  return { x: box.x + box.width * half, y: box.y + box.height * half };
}

/** Drags `from` by (dx, dy) with the mouse, in small steps so React Flow sees a drag. */
export async function dragBy(
  page: Page,
  from: Locator,
  delta: { x: number; y: number },
): Promise<void> {
  const start: { x: number; y: number } = await centerOf(from);
  const steps: number = 8;
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps });
  await page.mouse.up();
}
