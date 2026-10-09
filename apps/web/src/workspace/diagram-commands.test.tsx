import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildDiagramCommands, uniqueTitles } from './diagram-commands.ts';
import { selectActiveDiagram, useWorkspaceStore } from './use-workspace.ts';
import { setMediaQuery } from '../../tests/media.ts';
import { App } from '../app.tsx';
import { useUiStore } from '../state/ui-store.ts';

import type { Diagram } from '@nautink/storage/records';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

type User = ReturnType<typeof userEvent.setup>;

async function runCommand(user: User, text: string): Promise<void> {
  await user.keyboard('{Control>}k{/Control}');
  const palette = await screen.findByRole('dialog', { name: 'Command palette' });
  await user.type(within(palette).getByRole('combobox'), text);
  await user.keyboard('{Enter}');
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).toBeNull();
  });
}

async function renderApp(): Promise<User> {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByLabelText('Diagram code');
  return user;
}

const active = (): Diagram | undefined => selectActiveDiagram(useWorkspaceStore.getState());

describe('diagram commands in the palette', () => {
  it('creates, pins, duplicates, opens and deletes diagrams', async () => {
    const user = await renderApp();
    const first = active()?.id;
    await runCommand(user, 'new diagram');
    await waitFor(() => {
      expect(useWorkspaceStore.getState().diagrams).toHaveLength(2);
    });
    await runCommand(user, 'pin diagram');
    expect(active()?.pinned).toBe(true);
    await runCommand(user, 'unpin diagram');
    expect(active()?.pinned).toBe(false);
    await runCommand(user, 'duplicate diagram');
    await waitFor(() => {
      expect(useWorkspaceStore.getState().diagrams).toHaveLength(3);
    });
    await runCommand(user, 'delete diagram');
    await waitFor(() => {
      expect(useWorkspaceStore.getState().diagrams).toHaveLength(2);
    });
    const firstTitle = useWorkspaceStore.getState().diagrams.find((d) => d.id === first)?.title;
    await runCommand(user, `open “${firstTitle ?? ''}`);
    expect(active()?.id).toBe(first);
  });

  it('renames the diagram in place in the top bar', async () => {
    const user = await renderApp();
    await runCommand(user, 'rename diagram');
    const banner = screen.getByRole('banner');
    const input = await within(banner).findByRole('textbox', { name: 'Diagram title' });
    expect(document.activeElement).toBe(input);
    expect(useUiStore.getState().activePanel).toBe('chat');
    await user.keyboard('Checkout flow{Enter}');
    expect(active()?.title).toBe('Checkout flow');
    expect(useWorkspaceStore.getState().isTitleRenameRequested).toBe(false);
  });

  it('renames in the diagrams panel when the top bar hides the title, and searches there', async () => {
    setMediaQuery('(max-width: 767.98px)', true);
    const user = await renderApp();
    await runCommand(user, 'rename diagram');
    expect(useUiStore.getState().activePanel).toBe('diagrams');
    const input = await screen.findByRole('textbox', { name: 'Diagram title' });
    expect(document.activeElement).toBe(input);
    await user.keyboard('{Escape}');
    await runCommand(user, 'search diagrams');
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('searchbox'));
    });
  });

  it('downloads the open diagram', async () => {
    const createObjectURL = vi.fn(() => 'blob:x');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const user = await renderApp();
    await runCommand(user, 'download .mmd');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('does nothing to the open diagram before the workspace loads', () => {
    const togglePin = vi.fn();
    const commands = buildDiagramCommands(
      {
        getState: () => ({ ...useWorkspaceStore.getState(), togglePin }),
        getUi: useUiStore.getState,
      },
      { isPinned: false, recent: [] },
    );
    commands.find((command) => command.id === 'diagram.pin')?.run();
    expect(togglePin).not.toHaveBeenCalled();
  });
});

describe('uniqueTitles', () => {
  it('numbers repeated titles', () => {
    expect(uniqueTitles(['A', 'B', 'A', 'A'])).toEqual(['A', 'B', 'A (2)', 'A (3)']);
  });
});
