import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../app.tsx';
import { pickFiles } from '../lib/pick-files.ts';
import { useUiStore } from '../state/ui-store.ts';
import { selectActiveDiagram, useWorkspaceStore } from '../workspace/use-workspace.ts';

vi.mock('../lib/pick-files.ts', () => ({ pickFiles: vi.fn() }));

const picked = vi.mocked(pickFiles);
const blobs: Blob[] = [];

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
  );
  blobs.length = 0;
  URL.createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob);
    return 'blob:backup';
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  picked.mockReset();
});

async function renderApp(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByLabelText('Diagram code');
  return user;
}

function file(name: string, text: string): File {
  return new File([text], name, { type: 'text/plain' });
}

function drop(files: File[]): void {
  const dataTransfer = { types: ['Files'], files, dropEffect: 'none' };
  fireEvent(window, Object.assign(new Event('dragenter', { bubbles: true }), { dataTransfer }));
  fireEvent(window, Object.assign(new Event('dragover', { bubbles: true }), { dataTransfer }));
  fireEvent(window, Object.assign(new Event('drop', { bubbles: true }), { dataTransfer }));
}

const TWO_BLOCKS = '```mermaid\npie title One\n```\n\n```mermaid\nflowchart LR\n  a --> b\n```\n';

describe('import', () => {
  it('shows the drop overlay while files are dragged and imports what is dropped', async () => {
    await renderApp();
    const dataTransfer = { types: ['Files'], files: [], dropEffect: 'none' };
    fireEvent(window, Object.assign(new Event('dragenter'), { dataTransfer }));
    expect(screen.getByText('Drop to import')).toBeTruthy();
    fireEvent(window, Object.assign(new Event('dragleave'), { dataTransfer }));
    expect(screen.queryByText('Drop to import')).toBeNull();
    drop([file('notes.md', TWO_BLOCKS), file('photo.png', 'x')]);
    expect(await screen.findByText('Imported 2 diagrams')).toBeTruthy();
    expect(await screen.findByText('No Mermaid diagram found in photo.png')).toBeTruthy();
    expect(useWorkspaceStore.getState().diagrams).toHaveLength(3);
    expect(selectActiveDiagram(useWorkspaceStore.getState())?.title).toBe('notes 2');
  });

  it('ignores drags that carry no files', async () => {
    await renderApp();
    fireEvent(
      window,
      Object.assign(new Event('dragenter'), { dataTransfer: { types: ['text/plain'] } }),
    );
    expect(screen.queryByText('Drop to import')).toBeNull();
  });

  it('opens files from the diagrams panel footer', async () => {
    useUiStore.setState({ activePanel: 'diagrams' });
    picked.mockResolvedValue([file('checkout.mmd', 'flowchart TD\n  a --> b\n')]);
    const user = await renderApp();
    screen.getByRole('button', { name: 'Import or back up' }).focus();
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('menuitem', { name: 'Open file…' }));
    expect(await screen.findByText('Imported 1 diagram')).toBeTruthy();
    expect(selectActiveDiagram(useWorkspaceStore.getState())?.title).toBe('checkout');
  });
});

describe('backup and restore', () => {
  it('backs up from settings, then restores that file', async () => {
    const user = await renderApp();
    useWorkspaceStore.getState().applyEdit('pie title Kept\n', { label: 'x', source: 'code' });
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('button', { name: 'Back up all' }));
    expect(await screen.findByText('Backed up 1 diagram and 0 versions')).toBeTruthy();
    const text = await blobs[0]!.text();
    expect(JSON.parse(text)).toMatchObject({ format: 'nautink-backup' });
    picked.mockResolvedValue([file('nautink-backup.json', text)]);
    await user.click(screen.getByRole('button', { name: 'Restore backup' }));
    expect(await screen.findByText('Restored 1 diagram and 0 versions')).toBeTruthy();
    expect(useWorkspaceStore.getState().diagrams).toHaveLength(2);
  });

  it('explains why a file cannot be restored', async () => {
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    picked.mockResolvedValue([file('notes.json', '{"format":"other","version":1}')]);
    await user.click(await screen.findByRole('button', { name: 'Restore backup' }));
    expect(
      await screen.findByText(/^Could not restore notes\.json\. Unknown backup format/),
    ).toBeTruthy();
    picked.mockResolvedValue([file('broken.json', '{')]);
    await user.click(screen.getByRole('button', { name: 'Restore backup' }));
    expect(
      await screen.findByText('Could not restore broken.json. broken.json is not valid JSON.'),
    ).toBeTruthy();
    picked.mockResolvedValue([]);
    await user.click(screen.getByRole('button', { name: 'Restore backup' }));
    await waitFor(() => {
      expect(picked).toHaveBeenCalledTimes(3);
    });
  });

  it('offers open, back up and restore in the palette', async () => {
    const user = await renderApp();
    await user.keyboard('{Control>}k{/Control}');
    const palette = await screen.findByRole('dialog', { name: 'Command palette' });
    await user.type(within(palette).getByRole('combobox'), 'back up');
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(blobs).toHaveLength(1);
    });
  });
});
