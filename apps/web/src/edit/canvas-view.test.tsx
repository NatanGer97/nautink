import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../app.tsx';
import { selectActiveStack, useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { DiagramView } from '@nautink/storage/records';

const GANTT = 'gantt\n  title Plan\n  section A\n  Task :a1, 2024-01-01, 3d\n';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Renders the app, waits for the first diagram, and gives it `code` and `view`. */
async function openDiagram(code: string, view: DiagramView): Promise<string> {
  render(<App />);
  await waitFor(() => {
    expect(useWorkspaceStore.getState().activeId).not.toBeNull();
  });
  const id: string = useWorkspaceStore.getState().activeId ?? '';
  act(() => {
    useWorkspaceStore.getState().applyEdit(code, { label: 'Typed in code', source: 'code' });
    useWorkspaceStore.getState().setView(id, view);
  });
  return id;
}

function viewOf(id: string): DiagramView | undefined {
  return useWorkspaceStore.getState().diagrams.find((diagram) => diagram.id === id)?.view;
}

describe('canvas views for a type without a visual editor', () => {
  it('keeps Edit and Split off in the toggle, with the reason', async () => {
    const id = await openDiagram(GANTT, 'preview');
    const user = userEvent.setup();
    const edit = screen.getByRole('radio', { name: 'Edit' });
    expect(edit.getAttribute('aria-disabled')).toBe('true');
    await user.click(edit);
    expect(viewOf(id)).toBe('preview');
    act(() => {
      edit.focus();
    });
    expect(
      (await screen.findAllByText(/Visual editing isn't available for Gantt diagrams/)).length,
    ).toBeGreaterThan(0);
  });

  it('says so in Edit and offers the preview', async () => {
    const id = await openDiagram(GANTT, 'edit');
    const user = userEvent.setup();
    expect(
      await screen.findByText('No visual editor for Gantt yet. Use code or chat.'),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Show preview' }));
    expect(viewOf(id)).toBe('preview');
    expect(screen.getByRole('group', { name: 'Diagram preview' })).toBeTruthy();
  });

  it('falls back from Split to the preview alone', async () => {
    await openDiagram(GANTT, 'split');
    expect(screen.getByRole('group', { name: 'Diagram preview' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Visual editor' })).toBeNull();
  });

  it('invites an empty diagram to start from a template', async () => {
    await openDiagram('', 'edit');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Browse templates' }));
    expect(await screen.findByRole('dialog', { name: 'New diagram' })).toBeTruthy();
  });
});

describe('canvas views for a flowchart', () => {
  it('switches to Edit and Split from the toggle and saves the view on the diagram', async () => {
    const id = await openDiagram('flowchart TD\n  A[Start] --> B[Done]\n', 'preview');
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: 'Edit' }));
    expect(viewOf(id)).toBe('edit');
    expect(await screen.findByTestId('flow-node-A', {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Diagram preview' })).toBeNull();
    await user.click(screen.getByRole('radio', { name: 'Split' }));
    expect(viewOf(id)).toBe('split');
    expect(screen.getByRole('region', { name: 'Visual editor' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Mermaid render' })).toBeTruthy();
    expect(await screen.findByTestId('flow-node-B', {}, { timeout: 5000 })).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: 'Preview' }));
    expect(viewOf(id)).toBe('preview');
  });

  it('records canvas edits as visual steps in the undo history', async () => {
    await openDiagram('flowchart TD\n  A[Start]\n', 'edit');
    const user = userEvent.setup();
    await screen.findByTestId('flow-node-A', {}, { timeout: 5000 });
    await user.click(screen.getByRole('button', { name: 'Add shape' }));
    const stack = selectActiveStack(useWorkspaceStore.getState());
    expect(stack?.entries.at(-1)).toMatchObject({ label: 'Added node Process', source: 'visual' });
  });
});
