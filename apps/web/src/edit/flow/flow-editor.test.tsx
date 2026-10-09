import { TooltipProvider } from '@nautink/ui/components/tooltip';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FlowEditor } from './flow-editor.tsx';
import { CLAUDE_EDITING } from '../read-only-reason.ts';
import { requestSelection, useCanvasSelectionStore } from '../selection/canvas-selection.ts';
import { SYNTAX_ERROR_REASON } from '../use-editor-core.ts';

import type { VisualEditorProps } from '../editor-props.ts';

const CODE = 'flowchart TD\n  A[Start] --> B[Done]\n';

vi.mock('../positions/app-position-store.ts', async () => {
  const { MemoryPositionStore: Store } = await import('@nautink/visual-core/positions');
  return { appPositionStore: new Store() };
});

function renderEditor(overrides: Partial<VisualEditorProps> = {}): {
  onChange: ReturnType<typeof vi.fn>;
  rerender: (next: Partial<VisualEditorProps>) => void;
} {
  const onChange = vi.fn();
  const props: VisualEditorProps = {
    diagramId: 'd1',
    code: CODE,
    isDark: false,
    readOnlyReason: null,
    canSavePositions: true,
    onChange,
    ...overrides,
  };
  const view = render(
    <TooltipProvider>
      <FlowEditor {...props} />
    </TooltipProvider>,
  );
  return {
    onChange,
    rerender: (next): void => {
      view.rerender(
        <TooltipProvider>
          <FlowEditor {...props} {...next} />
        </TooltipProvider>,
      );
    },
  };
}

describe('FlowEditor', () => {
  it('shows the parsed diagram and edits a node through the inspector as one labelled step', async () => {
    const { onChange } = renderEditor();
    const user = userEvent.setup();
    const start = await screen.findByTestId('flow-node-A');
    expect(within(start).getByText('Start')).toBeTruthy();
    act(() => {
      requestSelection('d1', ['A']);
    });
    const inspector = await screen.findByRole('region', { name: 'Inspector' });
    expect(within(inspector).getByRole('heading', { name: 'Node' })).toBeTruthy();
    const label = within(inspector).getByLabelText('Label');
    await user.clear(label);
    await user.type(label, 'Begin{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('A[Begin]'),
      'Renamed Start → Begin',
    );
    await user.click(within(inspector).getByRole('button', { name: 'Decision' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('A{Begin}'),
      'Changed shape of Begin',
    );
    expect(useCanvasSelectionStore.getState().items).toEqual([
      { id: 'A', label: 'Begin', kind: 'node' },
    ]);
  });

  it('adds a shape from the toolbar and deletes from the inspector', async () => {
    const { onChange } = renderEditor();
    const user = userEvent.setup();
    await screen.findByTestId('flow-node-A');
    await user.click(screen.getByRole('button', { name: 'Add shape' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('n1[Process]'),
      'Added node Process',
    );
    await user.keyboard('{Escape}');
    act(() => {
      requestSelection('d1', ['B']);
    });
    const inspector = await screen.findByRole('region', { name: 'Inspector' });
    await user.click(within(inspector).getByRole('button', { name: 'Delete' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.not.stringContaining('B[Done]'),
      'Deleted Done',
    );
  });

  it('opens the library with shapes and icons', async () => {
    renderEditor();
    const user = userEvent.setup();
    await screen.findByTestId('flow-node-A');
    await user.click(screen.getByRole('button', { name: 'Library' }));
    const library = screen.getByRole('region', { name: 'Library' });
    expect(within(library).getByRole('button', { name: 'Decision (diam)' })).toBeTruthy();
    await user.type(within(library).getByLabelText('Search shapes'), 'cloud');
    expect(within(library).queryByRole('button', { name: 'Decision (diam)' })).toBeNull();
    await user.click(within(library).getByRole('tab', { name: 'Icons' }));
    expect(within(library).getByRole('combobox', { name: 'Icon pack' })).toBeTruthy();
    await user.click(within(library).getByRole('button', { name: 'Close library' }));
    expect(screen.queryByRole('region', { name: 'Library' })).toBeNull();
  });

  it('is read-only while Claude edits, and keeps the last canvas on a syntax error', async () => {
    const { rerender } = renderEditor({ readOnlyReason: CLAUDE_EDITING });
    await screen.findByTestId('flow-node-A');
    expect(screen.getByRole('status').textContent).toBe(CLAUDE_EDITING);
    expect(screen.getByRole('button', { name: 'Add shape' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    rerender({ readOnlyReason: null, code: `${CODE}  B -->\n` });
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe(SYNTAX_ERROR_REASON);
    });
    expect(screen.getByTestId('flow-node-B')).toBeTruthy();
  });

  it('places new nodes from outside changes (typing, Claude, undo)', async () => {
    const { rerender } = renderEditor();
    await screen.findByTestId('flow-node-A');
    rerender({ code: `${CODE}  B --> C[Later]\n` });
    expect(await screen.findByTestId('flow-node-C')).toBeTruthy();
  });

  it('lays the canvas out again without writing code, and changes direction as one step', async () => {
    const { onChange } = renderEditor();
    const user = userEvent.setup();
    await screen.findByTestId('flow-node-A');
    await user.click(screen.getByRole('button', { name: 'Auto layout' }));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('combobox', { name: 'Direction' }));
    await user.click(await screen.findByRole('option', { name: 'Left → right' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('flowchart LR'),
      'Changed direction to LR',
    );
  });

  it('says so when Mermaid reads the code as another type', async () => {
    renderEditor({ code: 'pie\n  "A" : 1\n' });
    expect(await screen.findByText(/cannot read this code as this diagram type/)).toBeTruthy();
  });
});
