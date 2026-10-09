import { openNautinkDb } from '@nautink/storage/db';
import { createDiagram } from '@nautink/storage/diagrams';
import { Toaster } from '@nautink/ui/components/sonner';
import { TooltipProvider } from '@nautink/ui/components/tooltip';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DiagramsPanel } from '../../shell/panels/diagrams-panel.tsx';
import { selectActiveDiagram, useWorkspaceStore } from '../use-workspace.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

const HOUR = 3_600_000;

/** Seeds the app's database with three diagrams, then renders the panel over the loaded store. */
async function renderPanel(): Promise<ReturnType<typeof userEvent.setup>> {
  const db = await openNautinkDb();
  const now = Date.now();
  await createDiagram(db, {
    title: 'Checkout flow',
    titleAuto: false,
    code: 'flowchart TD\n  cart --> pay',
    updatedAt: now - HOUR,
  });
  await createDiagram(db, {
    title: 'OAuth login',
    titleAuto: false,
    code: 'sequenceDiagram\n  Browser->>Auth: authorize with PKCE',
    pinned: true,
    updatedAt: now - 30 * HOUR,
  });
  await createDiagram(db, {
    title: 'Orders schema',
    titleAuto: false,
    code: 'erDiagram\n  ORDER ||--o{ LINE : has',
    updatedAt: now,
  });
  db.close();
  await act(async () => useWorkspaceStore.getState().load());
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <DiagramsPanel />
      <Toaster />
    </TooltipProvider>,
  );
  return user;
}

const optionNames = (): string[] =>
  screen.getAllByRole('option').map((option) => option.getAttribute('aria-label') ?? '');

const activeTitle = (): string | undefined =>
  selectActiveDiagram(useWorkspaceStore.getState())?.title;

describe('DiagramsPanel', () => {
  it('lists diagrams pinned first, then the most recent, with type and time', async () => {
    await renderPanel();
    expect(optionNames()).toEqual([
      'OAuth login, Sequence, Yesterday, pinned',
      'Orders schema, ER, just now',
      'Checkout flow, Flowchart, 1 h ago',
    ]);
    expect(screen.getByText('3 diagrams')).toBeTruthy();
    expect(screen.getByRole('option', { selected: true }).getAttribute('aria-label')).toMatch(
      /^OAuth login/,
    );
  });

  it('searches titles and code, showing the matching line', async () => {
    const user = await renderPanel();
    const search = screen.getByRole('searchbox', { name: 'Search diagrams' });
    await user.type(search, 'orders');
    expect(optionNames()).toEqual(['Orders schema, ER, just now']);
    await user.clear(search);
    await user.type(search, 'pkce');
    expect(optionNames()).toHaveLength(1);
    expect(screen.getByText('PKCE').tagName).toBe('MARK');
    await user.type(search, 'zzz');
    expect(screen.getByText('No diagrams match “pkcezzz”')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(optionNames()).toHaveLength(3);
    expect(document.activeElement).toBe(search);
  });

  it('filters by type and by pin', async () => {
    const user = await renderPanel();
    const chips = screen.getByRole('radiogroup', { name: 'Filter by type' });
    expect(
      within(chips)
        .getAllByRole('radio')
        .map((chip) => chip.textContent),
    ).toEqual(['All', 'Pinned', 'ER', 'Flowchart', 'Sequence']);
    await user.click(within(chips).getByRole('radio', { name: 'Flowchart' }));
    expect(optionNames()).toEqual(['Checkout flow, Flowchart, 1 h ago']);
    await user.click(within(chips).getByRole('radio', { name: 'Flowchart' }));
    expect(optionNames()).toHaveLength(1);
    await user.click(within(chips).getByRole('radio', { name: 'Pinned' }));
    expect(optionNames()).toEqual(['OAuth login, Sequence, Yesterday, pinned']);
    await user.type(screen.getByRole('searchbox'), 'orders');
    expect(screen.getByText('No diagrams match “orders”')).toBeTruthy();
  });

  it('renames inline from a double-click and from F2', async () => {
    const user = await renderPanel();
    await user.dblClick(screen.getByRole('option', { name: /^Orders schema/ }));
    const input = screen.getByRole('textbox', { name: 'Diagram title' });
    await user.clear(input);
    await user.type(input, 'Order tables{Enter}');
    expect(screen.getByRole('option', { name: /^Order tables/ })).toBeTruthy();
    const list = screen.getByRole('listbox', { name: 'Diagrams' });
    expect(document.activeElement).toBe(list);
    await user.keyboard('{End}{F2}');
    await user.keyboard('Other{Escape}');
    expect(screen.getByRole('option', { name: /^Checkout flow/ })).toBeTruthy();
  });

  it('moves through the list with the keyboard and opens a row with Enter', async () => {
    const user = await renderPanel();
    await user.click(screen.getByRole('searchbox'));
    await user.keyboard('{ArrowDown}');
    const list = screen.getByRole('listbox', { name: 'Diagrams' });
    expect(document.activeElement).toBe(list);
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(list.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: /^Checkout flow/ }).id,
    );
    await user.keyboard('{Enter}');
    expect(activeTitle()).toBe('Checkout flow');
    await user.keyboard('{Home}{Enter}');
    expect(activeTitle()).toBe('OAuth login');
    await user.click(screen.getByRole('option', { name: /^Orders schema/ }));
    expect(activeTitle()).toBe('Orders schema');
  });

  it('opens the first result with Enter in the search box, and clears it with Escape', async () => {
    const user = await renderPanel();
    await user.type(screen.getByRole('searchbox'), 'cart{Enter}');
    expect(activeTitle()).toBe('Checkout flow');
    await user.keyboard('{Escape}');
    expect(optionNames()).toHaveLength(3);
    await user.keyboard('zzz{ArrowDown}{Enter}');
    expect(activeTitle()).toBe('Checkout flow');
  });

  it('deletes from the row menu and puts the diagram back with Undo', async () => {
    const user = await renderPanel();
    await user.click(screen.getByRole('button', { name: 'Actions for Orders schema' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await waitFor(() => {
      expect(optionNames()).toHaveLength(2);
    });
    expect(await screen.findByText('Deleted “Orders schema”')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => {
      expect(optionNames()).toHaveLength(3);
    });
  });

  it('pins, duplicates, downloads and renames from the row menu and the keyboard', async () => {
    const createObjectURL = vi.fn(() => 'blob:x');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const user = await renderPanel();
    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('option', { name: /^Checkout/ }),
    });
    await user.click(await screen.findByRole('menuitem', { name: 'Pin to top' }));
    expect(
      screen.getByRole('option', { name: /^Checkout flow, Flowchart, 1 h ago, pinned/ }),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Actions for Checkout flow' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Download .mmd' }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Actions for Checkout flow' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Duplicate' }));
    expect(await screen.findByRole('option', { name: /^Checkout flow copy/ })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Actions for Orders schema' }));
    await user.click(await screen.findByRole('menuitem', { name: /Rename/ }));
    expect(screen.getByRole('textbox', { name: 'Diagram title' })).toBeTruthy();
    await user.keyboard('{Escape}');
    await user.keyboard('{Home}{Shift>}{F10}{/Shift}');
    expect(await screen.findByRole('menuitem', { name: 'Unpin' })).toBeTruthy();
  });

  it('creates a diagram from the header', async () => {
    const user = await renderPanel();
    await user.click(screen.getByRole('button', { name: 'New diagram' }));
    await waitFor(() => {
      expect(optionNames()).toHaveLength(4);
    });
    expect(screen.getByText('4 diagrams')).toBeTruthy();
  });

  it('shows loading, then a load error with a retry', async () => {
    useWorkspaceStore.setState({ status: 'loading' });
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <DiagramsPanel />
      </TooltipProvider>,
    );
    expect(screen.getByText('Opening your diagrams…')).toBeTruthy();
    act(() => {
      useWorkspaceStore.setState({ status: 'error', loadError: 'blocked' });
    });
    expect(screen.getByText('blocked')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('1 diagram')).toBeTruthy();
  });

  it('focuses the search box when ⌘K asks for it', async () => {
    await renderPanel();
    act(() => {
      useWorkspaceStore.getState().requestSearchFocus();
    });
    expect(document.activeElement).toBe(screen.getByRole('searchbox'));
    expect(useWorkspaceStore.getState().isSearchFocusRequested).toBe(false);
  });
});
