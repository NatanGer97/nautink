import { TooltipProvider } from '@nautink/ui/components/tooltip';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ASK_CLAUDE_TO_FIX_EVENT } from './ask-claude-to-fix.ts';
import { revealLineInCode, useCodeRevealStore } from './code-reveal.ts';
import { fakeMonaco, fakeMonacoState, resetFakeMonaco } from '../../tests/fake-monaco.ts';
import { useChatStore } from '../chat/chat-store.ts';
import { usePreviewStatusStore } from '../preview/preview-status.ts';
import { CodeDrawer } from '../shell/code-drawer.tsx';
import {
  selectActiveDiagram,
  selectActiveStack,
  useWorkspaceStore,
} from '../workspace/use-workspace.ts';

import type { FakeEditor } from '../../tests/fake-monaco.ts';

vi.mock('./load-monaco.ts', () => ({
  loadMonaco: async (): Promise<typeof fakeMonaco> => Promise.resolve(fakeMonaco),
}));

const code = (): string | undefined => selectActiveDiagram(useWorkspaceStore.getState())?.code;
const labels = (): string[] =>
  selectActiveStack(useWorkspaceStore.getState())
    ?.entries.slice(1)
    .map((entry) => entry.label) ?? [];

beforeEach(() => {
  resetFakeMonaco();
});

afterEach(() => {
  usePreviewStatusStore.getState().reset();
  vi.unstubAllGlobals();
});

async function renderDrawer(): Promise<FakeEditor> {
  await useWorkspaceStore.getState().load();
  render(
    <TooltipProvider>
      <CodeDrawer />
    </TooltipProvider>,
  );
  expect(screen.getByRole('status').textContent).toBe('Loading the code editor…');
  await waitFor(() => {
    expect(fakeMonacoState.editors[0]?.getModel()).toBeTruthy();
  });
  const created = fakeMonacoState.editors[0];
  if (created === undefined) {
    throw new Error('No editor was created.');
  }
  return created;
}

describe('the code drawer', () => {
  it('shows the open diagram in its own model, in the app theme', async () => {
    const editor = await renderDrawer();
    expect(editor.getModel()?.getValue()).toBe('flowchart TD\n');
    expect(editor.container.getAttribute('data-edit-history')).toBe('app');
    expect(fakeMonacoState.theme).toBe('nautink-light');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText(/\.mmd$/)).toBeTruthy();
  });

  it('records typing as one step until a cursor jump, and a paste as its own step', async () => {
    const editor = await renderDrawer();
    act(() => {
      editor.typeAtEnd('  a');
      editor.typeAtEnd(' --> b');
    });
    expect(code()).toBe('flowchart TD\n  a --> b');
    expect(labels()).toEqual(['Typed in code']);
    act(() => {
      editor.moveCursor({ lineNumber: 1, column: 1 }, 'mouse');
      editor.typeAtEnd('\n');
    });
    expect(labels()).toEqual(['Typed in code', 'Typed in code']);
    act(() => {
      fireEvent.paste(editor.container);
      editor.typeAtEnd('  c');
    });
    expect(labels().at(-1)).toBe('Pasted code');
    expect(screen.getByText('Ln 1, Col 1')).toBeTruthy();
  });

  it('follows undo and changes made elsewhere, putting the cursor back', async () => {
    const editor = await renderDrawer();
    editor.focus();
    act(() => {
      editor.setSelection({
        selectionStartLineNumber: 2,
        selectionStartColumn: 4,
        positionLineNumber: 2,
        positionColumn: 4,
      });
      editor.typeAtEnd('  a');
    });
    act(() => {
      useWorkspaceStore.getState().applyEdit('flowchart LR\n  a', {
        label: 'Claude: Turn it',
        source: 'claude',
      });
    });
    expect(editor.getModel()?.getValue()).toBe('flowchart LR\n  a');
    expect(editor.getPosition()).toEqual({ lineNumber: 1, column: 13 });
    act(() => {
      useWorkspaceStore.getState().undo();
    });
    expect(editor.getModel()?.getValue()).toBe('flowchart TD\n  a');
    expect(editor.getPosition()).toEqual({ lineNumber: 2, column: 4 });
    expect(labels()).toEqual(['Typed in code', 'Claude: Turn it']);
  });

  it('marks the failing line and offers to ask Claude to fix it', async () => {
    const editor = await renderDrawer();
    const diagramId = useWorkspaceStore.getState().activeId ?? '';
    const error = { message: 'Parse error on line 1', line: 1 };
    act(() => {
      usePreviewStatusStore.getState().report({ kind: 'failed', diagramId, error });
    });
    const key = `mermaid:${editor.getModel()?.uri.toString() ?? ''}`;
    expect(fakeMonacoState.markers.get(key)).toHaveLength(1);
    const asked = vi.fn();
    window.addEventListener(ASK_CLAUDE_TO_FIX_EVENT, asked);
    fireEvent.click(screen.getByRole('button', { name: 'Ask Claude to fix' }));
    window.removeEventListener(ASK_CLAUDE_TO_FIX_EVENT, asked);
    expect((asked.mock.calls[0]?.[0] as CustomEvent).detail).toEqual(error);
    act(() => {
      usePreviewStatusStore
        .getState()
        .report({ kind: 'rendered', diagramId, svg: '', renderMs: 1 });
    });
    expect(fakeMonacoState.markers.get(key)).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Ask Claude to fix' })).toBeNull();
  });

  it('switches models with the open diagram and disposes deleted ones', async () => {
    const editor = await renderDrawer();
    const firstModel = editor.getModel();
    await act(async () => {
      await useWorkspaceStore.getState().createDiagram();
    });
    expect(editor.getModel()).not.toBe(firstModel);
    const firstId = firstModel?.uri.path.slice(1, -'.mmd'.length) ?? '';
    await act(async () => {
      await useWorkspaceStore.getState().deleteDiagram(firstId);
    });
    expect(firstModel?.isDisposed()).toBe(true);
  });

  it('copies the code', async () => {
    const writeText = vi.fn(async () => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith('flowchart TD\n');
  });

  it('selects a line asked for from the canvas, once the editor is up', async () => {
    await useWorkspaceStore.getState().load();
    act(() => {
      useWorkspaceStore.getState().applyEdit('flowchart TD\n  a --> b\n  b', {
        label: 'Pasted code',
        source: 'code',
      });
      revealLineInCode({ diagramId: useWorkspaceStore.getState().activeId ?? '', line: 2 });
    });
    const editor = await renderDrawer();
    await waitFor(() => {
      expect(editor.getSelection()).toEqual({
        selectionStartLineNumber: 2,
        selectionStartColumn: 1,
        positionLineNumber: 2,
        positionColumn: 10,
      });
    });
    expect(editor.hasTextFocus()).toBe(true);
    expect(useCodeRevealStore.getState().request).toBeNull();
    expect(screen.getByText('Ln 2, Col 10')).toBeTruthy();
  });

  it('is read-only while Claude edits this diagram', async () => {
    const editor = await renderDrawer();
    const diagramId = useWorkspaceStore.getState().activeId ?? '';
    act(() => {
      useChatStore.setState({ busyDiagramId: diagramId });
    });
    expect(editor.options).toMatchObject({ readOnly: true });
    expect(screen.getByRole('status').textContent).toMatch(/^Claude is editing/);
    act(() => {
      useChatStore.setState({ busyDiagramId: null });
    });
    expect(editor.options).toMatchObject({ readOnly: false });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
