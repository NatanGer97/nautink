import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../app.tsx';
import { useUiStore } from '../state/ui-store.ts';
import {
  selectActiveDiagram,
  selectActiveStack,
  useWorkspaceStore,
} from '../workspace/use-workspace.ts';

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

async function openGallery(): Promise<{
  user: ReturnType<typeof userEvent.setup>;
  gallery: HTMLElement;
}> {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByLabelText('Diagram code');
  await user.click(screen.getByRole('button', { name: 'Templates' }));
  return { user, gallery: await screen.findByRole('dialog', { name: 'New diagram' }) };
}

describe('new diagram gallery', () => {
  it('shows the 14 types, filters by category and search', async () => {
    const { user, gallery } = await openGallery();
    expect(within(gallery).getAllByRole('article')).toHaveLength(14);
    await user.click(within(gallery).getByRole('button', { name: /^Visual editor/ }));
    expect(within(gallery).getAllByRole('article')).toHaveLength(5);
    expect(within(gallery).getAllByRole('button', { name: /^Start a blank/ })).toHaveLength(5);
    await user.click(within(gallery).getByRole('button', { name: /^All/ }));
    await user.type(within(gallery).getByRole('searchbox', { name: 'Search templates' }), 'kanban');
    expect(within(gallery).getAllByRole('article')).toHaveLength(1);
    await user.type(within(gallery).getByRole('searchbox'), 'zzz');
    expect(within(gallery).getByText('No template matches that search.')).toBeTruthy();
  });

  it('creates a diagram from an example and opens it', async () => {
    const { user, gallery } = await openGallery();
    await user.click(within(gallery).getByRole('button', { name: 'Use the pie chart example' }));
    await waitFor(() => {
      expect(useWorkspaceStore.getState().diagrams).toHaveLength(2);
    });
    const state = useWorkspaceStore.getState();
    expect(selectActiveDiagram(state)?.code).toMatch(/^pie title Traffic sources/);
    expect(selectActiveDiagram(state)?.title).toBe('Traffic sources');
    expect(selectActiveStack(state)?.entries[0]?.label).toBe('New pie chart from example');
    expect(screen.queryByRole('dialog', { name: 'New diagram' })).toBeNull();
  });

  it('starts a blank diagram of a visual editor type', async () => {
    const { user, gallery } = await openGallery();
    await user.click(within(gallery).getByRole('button', { name: 'Start a blank sequence' }));
    await waitFor(() => {
      expect(selectActiveDiagram(useWorkspaceStore.getState())?.code).toBe('sequenceDiagram\n');
    });
    expect(selectActiveDiagram(useWorkspaceStore.getState())?.view).toBe('edit');
  });

  it('sends the user to chat to describe the diagram instead', async () => {
    const { user, gallery } = await openGallery();
    await user.click(within(gallery).getByRole('button', { name: /^Or describe it/ }));
    expect(useUiStore.getState().activePanel).toBe('chat');
    expect(useUiStore.getState().isTemplatesOpen).toBe(false);
  });

  it('opens from the palette and from the diagrams panel', async () => {
    useUiStore.setState({ activePanel: 'diagrams' });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByLabelText('Diagram code');
    await user.click(screen.getByRole('button', { name: 'New from a template' }));
    expect(useUiStore.getState().isTemplatesOpen).toBe(true);
    await user.keyboard('{Escape}');
    await user.keyboard('{Control>}k{/Control}');
    const palette = await screen.findByRole('dialog', { name: 'Command palette' });
    await user.type(within(palette).getByRole('combobox'), 'template gallery');
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('dialog', { name: 'New diagram' })).toBeTruthy();
  });
});
