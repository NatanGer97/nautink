import { addVersion, listVersions } from '@nautink/storage/versions';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { announceVersionsChanged, useVersionsStore } from './versions-store.ts';
import { useViewedVersionStore } from './viewed-version.ts';
import { App } from '../app.tsx';
import { usePreviewStatusStore } from '../preview/preview-status.ts';
import { useUiStore } from '../state/ui-store.ts';
import { selectActiveDiagram, useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { VersionKind } from '@nautink/storage/records';

vi.mock('../mermaid/render-thumbnail.ts', () => ({
  renderThumbnail: async (): Promise<unknown> =>
    Promise.resolve({ kind: 'error', message: 'Not drawn in tests' }),
}));

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function activeId(): string {
  return useWorkspaceStore.getState().activeId ?? '';
}

function activeCode(): string {
  return selectActiveDiagram(useWorkspaceStore.getState())?.code ?? '';
}

async function renderHistory(): Promise<ReturnType<typeof userEvent.setup>> {
  useUiStore.setState({ activePanel: 'history' });
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('group', { name: 'Diagram preview' });
  await screen.findByText('No versions yet');
  return user;
}

async function seed(
  versions: { code: string; kind: VersionKind; label?: string; prompt?: string }[],
): Promise<void> {
  const db = useWorkspaceStore.getState().requireDb();
  for (const version of versions) {
    await addVersion(db, { diagramId: activeId(), ...version });
  }
  act(() => {
    announceVersionsChanged(activeId());
  });
  await waitFor(() => {
    expect(useVersionsStore.getState().versions).toHaveLength(versions.length);
  });
}

/** The floating bar over the canvas while a version is viewed. */
function canvasBar(): HTMLElement {
  return screen.getByRole('region', { name: 'Viewed version' });
}

function panel(): HTMLElement {
  return screen.getByRole('complementary', { name: 'History' });
}

async function clickToastUndo(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await waitFor(() => {
    expect(document.querySelector('[data-sonner-toast] button')).not.toBeNull();
  });
  const toast = document.querySelector<HTMLElement>('[data-sonner-toast]');
  await user.click(within(toast!).getByRole('button', { name: 'Undo' }));
}

function edit(code: string): void {
  act(() => {
    useWorkspaceStore.getState().applyEdit(code, { label: 'Typed in code', source: 'code' });
  });
}

describe('history panel', () => {
  it('lists the versions newest first under a Current row', async () => {
    await renderHistory();
    await seed([
      { code: 'flowchart TD\n  a', kind: 'manual', label: 'First draft' },
      { code: 'flowchart TD\n  b', kind: 'claude', prompt: 'Add b' },
      { code: 'flowchart TD\n  c', kind: 'restore' },
    ]);
    const options = within(panel()).getAllByRole('option');
    expect(options.map((option) => option.getAttribute('aria-label'))).toEqual([
      'Current, now, Current version',
      expect.stringMatching(/^Before restore, \d\d:\d\d, Code before a restore$/),
      expect.stringMatching(/^Claude, \d\d:\d\d, Add b$/),
      expect.stringMatching(/^Saved, \d\d:\d\d, First draft$/),
    ]);
    expect(within(panel()).getByText('3 versions · kept in this browser')).toBeTruthy();
    expect(within(panel()).getByRole('group', { name: 'Today' })).toBeTruthy();
  });

  it('views a version with the keyboard and goes back with Escape', async () => {
    const user = await renderHistory();
    await seed([{ code: 'flowchart TD\n  old', kind: 'manual', label: 'Old' }]);
    const footer = screen.getByRole('contentinfo');
    expect(footer.textContent).toContain('1 version');
    expect(footer.textContent).toContain('Saved');
    within(panel()).getByRole('listbox', { name: 'Versions' }).focus();
    await user.keyboard('{ArrowDown}');
    expect(footer.textContent).toContain('Viewing an older version · read-only');
    expect(footer.textContent).toContain('2 lines');
    const bar = screen.getByRole('region', { name: 'Viewed version' });
    expect(bar.textContent).toMatch(/Viewing \d\d:\d\d · Old/);
    expect(within(panel()).getByRole('region', { name: 'Version details' })).toBeTruthy();
    await waitFor(() => {
      expect(usePreviewStatusStore.getState().diagramId).toMatch(/^version:/);
    });
    expect(useViewedVersionStore.getState().version?.label).toBe('Old');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Viewed version' })).toBeNull();
    expect(useViewedVersionStore.getState().version).toBeNull();
    expect(footer.textContent).not.toContain('Viewing an older version');
  });

  it('saves a named version with ⌘S, and names the latest when nothing changed', async () => {
    const user = await renderHistory();
    await user.keyboard('{Control>}s{/Control}');
    const dialog = await screen.findByRole('dialog', { name: 'Save version' });
    await user.type(within(dialog).getByLabelText('Version name'), 'First draft');
    await user.keyboard('{Control>}s{/Control}');
    expect(
      await within(panel()).findByRole('option', { name: /^Saved, .*First draft$/ }),
    ).toBeTruthy();
    expect(await screen.findByText('Saved version “First draft”')).toBeTruthy();
    await user.click(within(panel()).getByRole('button', { name: /^Save version/ }));
    await user.type(screen.getByLabelText('Version name'), 'Renamed{Enter}');
    expect(await within(panel()).findByRole('option', { name: /Renamed$/ })).toBeTruthy();
    expect(await listVersions(useWorkspaceStore.getState().requireDb(), activeId())).toHaveLength(
      1,
    );
  });

  it('renames and deletes a version, and undoes the delete', async () => {
    const user = await renderHistory();
    await seed([{ code: 'flowchart TD\n  old', kind: 'claude', prompt: 'Add old' }]);
    await user.click(within(panel()).getByRole('option', { name: /Add old$/ }));
    await user.click(within(panel()).getByRole('button', { name: 'Name version' }));
    await user.keyboard('Kept{Enter}');
    expect(await within(panel()).findByRole('option', { name: /Kept$/ })).toBeTruthy();
    expect(within(panel()).getByText('“Add old”')).toBeTruthy();
    await user.click(within(panel()).getByRole('button', { name: 'Delete version' }));
    await waitFor(() => {
      expect(within(panel()).queryByRole('option', { name: /Kept$/ })).toBeNull();
    });
    await clickToastUndo(user);
    expect(await within(panel()).findByRole('option', { name: /Kept$/ })).toBeTruthy();
  });

  it('restores a version as one step, keeps the code before it, and undoes it', async () => {
    const user = await renderHistory();
    await seed([{ code: 'flowchart TD\n  saved', kind: 'manual', label: 'Saved one' }]);
    edit('flowchart TD\n  edited');
    await user.click(within(panel()).getByRole('option', { name: /Saved one$/ }));
    await user.click(within(canvasBar()).getByRole('button', { name: 'Restore this version' }));
    await waitFor(() => {
      expect(activeCode()).toBe('flowchart TD\n  saved');
    });
    expect(await within(panel()).findByRole('option', { name: /^Before restore/ })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Viewed version' })).toBeNull();
    expect(await screen.findByText('Restored the version')).toBeTruthy();
    await clickToastUndo(user);
    expect(activeCode()).toBe('flowchart TD\n  edited');
  });

  it('compares a version with the current code and closes with Escape', async () => {
    const user = await renderHistory();
    await seed([{ code: 'flowchart TD\n  a --> b', kind: 'manual', label: 'Before' }]);
    edit('flowchart TD\n  a --> c\n  c --> d');
    await user.click(within(panel()).getByRole('option', { name: /Before$/ }));
    await user.click(within(canvasBar()).getByRole('button', { name: 'Compare with current' }));
    const drawer = screen.getByRole('region', { name: 'Changes since this version' });
    expect(drawer.textContent).toContain('+2');
    expect(drawer.textContent).toContain('−1');
    expect(within(drawer).getByText('a --> b', { exact: false }).textContent).toContain('Removed');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Changes since this version' })).toBeNull();
  });

  it('disables restore for a version equal to the current code', async () => {
    const user = await renderHistory();
    await seed([{ code: activeCode(), kind: 'manual', label: 'Same' }]);
    await user.click(within(panel()).getByRole('option', { name: /Same$/ }));
    const restore = within(canvasBar()).getByRole('button', { name: 'Restore this version' });
    expect(restore.hasAttribute('disabled')).toBe(true);
    expect(within(panel()).getByText('This version is the current code.')).toBeTruthy();
  });
});
