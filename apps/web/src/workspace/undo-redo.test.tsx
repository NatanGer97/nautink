import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { historyKeyAction, isTextField } from './history-shortcuts.ts';
import { selectActiveDiagram, useWorkspaceStore } from './use-workspace.ts';
import { App } from '../app.tsx';

import type { KeyEventLike } from '../lib/shortcuts.ts';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const code = (): string | undefined => selectActiveDiagram(useWorkspaceStore.getState())?.code;

/** The app, loaded, with two steps after the first: a paste and a Claude turn. */
async function renderWithSteps(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('group', { name: 'Diagram preview' });
  const { applyEdit } = useWorkspaceStore.getState();
  applyEdit('flowchart TD\n  a', { label: 'Pasted code', source: 'code' });
  applyEdit('flowchart TD\n  a --> b', { label: 'Claude: Link a to b', source: 'claude' });
  return user;
}

/**
 * Opens the step menu from the keyboard: in jsdom every pane has zero size, so the resize handles
 * claim each pointer press before Radix sees it. The e2e suite clicks it for real.
 */
async function openStepMenu(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  act(() => {
    screen.getByRole('button', { name: 'Undo history' }).focus();
  });
  await user.keyboard('{Enter}');
}

describe('undo and redo in the top bar', () => {
  it('names the next step on each button and moves through the history', async () => {
    const user = await renderWithSteps();
    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('button', { name: 'Redo' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    await user.click(within(banner).getByRole('button', { name: 'Undo: Claude: Link a to b' }));
    expect(code()).toBe('flowchart TD\n  a');
    expect(await screen.findByText('Undid “Claude: Link a to b”')).toBeTruthy();
    await user.click(within(banner).getByRole('button', { name: 'Redo: Claude: Link a to b' }));
    expect(code()).toBe('flowchart TD\n  a --> b');
  });

  it('jumps to any step from the step menu', async () => {
    const user = await renderWithSteps();
    await openStepMenu(user);
    const menu = await screen.findByRole('menu');
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringMatching(/^Claude: Link a to bClaude · just nowNow$/),
      expect.stringMatching(/^Pasted codeCode · just now$/),
      expect.stringMatching(/^New blank flowchartTemplate · just now$/),
    ]);
    await user.click(within(menu).getByRole('menuitem', { name: /New blank flowchart/ }));
    expect(code()).toBe('flowchart TD\n');
    await openStepMenu(user);
    const reopened = await screen.findByRole('menu');
    expect(
      within(reopened)
        .getByRole('menuitem', { name: /New blank flowchart/ })
        .getAttribute('aria-current'),
    ).toBe('step');
  });

  it('runs ⌘Z, ⌘⇧Z and ⌘Y outside text fields only', async () => {
    const user = await renderWithSteps();
    await user.keyboard('{Meta>}z{/Meta}');
    expect(code()).toBe('flowchart TD\n  a');
    await user.keyboard('{Meta>}{Shift>}z{/Shift}{/Meta}');
    expect(code()).toBe('flowchart TD\n  a --> b');
    await user.keyboard('{Control>}z{/Control}{Control>}z{/Control}');
    expect(code()).toBe('flowchart TD\n');
    await user.keyboard('{Control>}y{/Control}');
    expect(code()).toBe('flowchart TD\n  a');
    // Focused directly: in jsdom every panel has zero size, so a click lands on a resize handle.
    act(() => {
      screen.getByLabelText('Message Claude').focus();
    });
    await user.keyboard('{Meta>}z{/Meta}');
    expect(code()).toBe('flowchart TD\n  a');
  });

  it('offers undo and redo in the command palette', async () => {
    const user = await renderWithSteps();
    await user.keyboard('{Control>}k{/Control}');
    const palette = await screen.findByRole('dialog', { name: 'Command palette' });
    await user.type(within(palette).getByRole('combobox'), 'undo');
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(code()).toBe('flowchart TD\n  a');
    });
  });
});

describe('history keys', () => {
  it('maps the shortcuts', () => {
    const key = (k: string, mods: Partial<KeyboardEvent> = {}): KeyEventLike => ({
      key: k,
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      ...mods,
    });
    expect(historyKeyAction(key('z'))).toBe('undo');
    expect(historyKeyAction(key('Z', { shiftKey: true }))).toBe('redo');
    expect(historyKeyAction(key('y'))).toBe('redo');
    expect(historyKeyAction(key('y', { shiftKey: true }))).toBeUndefined();
    expect(historyKeyAction(key('z', { metaKey: false }))).toBeUndefined();
  });

  it('leaves text fields their own undo, unless they opt in', () => {
    document.body.innerHTML =
      '<input id="plain"><div contenteditable="true" id="rich"></div><div data-edit-history="app"><textarea id="code"></textarea></div><button id="button"></button>';
    expect(isTextField(document.getElementById('plain'))).toBe(true);
    expect(isTextField(document.getElementById('code'))).toBe(false);
    expect(isTextField(document.getElementById('button'))).toBe(false);
    expect(isTextField(null)).toBe(false);
    expect(isTextField(window)).toBe(false);
  });
});
