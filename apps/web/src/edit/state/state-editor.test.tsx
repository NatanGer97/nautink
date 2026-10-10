import { TooltipProvider } from '@nautink/ui/components/tooltip';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { StateEditor } from './state-editor.tsx';
import { agentEditingText } from '../read-only-reason.ts';
import { requestSelection, useCanvasSelectionStore } from '../selection/canvas-selection.ts';
import { SYNTAX_ERROR_REASON } from '../use-editor-core.ts';

import type { VisualEditorProps } from '../editor-props.ts';

const CODE = 'stateDiagram-v2\n    [*] --> Idle\n    Idle --> Busy : start\n    Busy --> [*]\n';

const NESTED =
  'stateDiagram-v2\n    state Active {\n        [*] --> Running\n        Running --> Paused\n    }\n    Idle --> Active\n    note right of Idle : Waits here\n';

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
      <StateEditor {...props} />
    </TooltipProvider>,
  );
  return {
    onChange,
    rerender: (next): void => {
      view.rerender(
        <TooltipProvider>
          <StateEditor {...props} {...next} />
        </TooltipProvider>,
      );
    },
  };
}

async function inspectorFor(ids: string[]): Promise<HTMLElement> {
  act(() => {
    requestSelection('d1', ids);
  });
  return screen.findByRole('region', { name: 'Inspector' });
}

describe('StateEditor', () => {
  it('shows the parsed diagram and edits a state through the inspector as one labelled step', async () => {
    const { onChange } = renderEditor();
    const user = userEvent.setup();
    expect(within(await screen.findByTestId('state-node-Idle')).getByText('Idle')).toBeTruthy();
    expect(screen.getByTestId('state-node-start:')).toBeTruthy();
    const inspector = await inspectorFor(['Idle']);
    expect(within(inspector).getByRole('heading', { name: 'State' })).toBeTruthy();
    await user.type(within(inspector).getByLabelText('Display name'), 'Waiting{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('state "Waiting" as Idle'),
      'Renamed Idle → Waiting',
    );
    await user.click(within(inspector).getByRole('radio', { name: 'Choice' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('state Idle <<choice>>'),
      'Edited state Waiting',
    );
    expect(useCanvasSelectionStore.getState().items).toEqual([
      { id: 'Idle', label: 'Idle', kind: 'state' },
    ]);
  });

  it('shows `Id : text` as the state description on the canvas and in the inspector', async () => {
    const { onChange } = renderEditor({ code: `${CODE}    Idle : Waiting for work\n` });
    const user = userEvent.setup();
    const idle = await screen.findByTestId('state-node-Idle');
    expect(within(idle).getByText('Idle')).toBeTruthy();
    expect(within(idle).getByText('Waiting for work')).toBeTruthy();
    const inspector = await inspectorFor(['Idle']);
    expect(within(inspector).getByLabelText<HTMLInputElement>('Display name').value).toBe('');
    const description = within(inspector).getByLabelText<HTMLTextAreaElement>('Description');
    expect(description.value).toBe('Waiting for work');
    await user.type(description, ' now');
    act(() => {
      description.blur();
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('    Idle : Waiting for work now\n'),
      expect.any(String),
    );
    expect(onChange.mock.lastCall?.[0]).not.toContain('state "');
  });

  it('adds a state from the toolbar, renames it inline and deletes from the inspector', async () => {
    const { onChange } = renderEditor();
    const user = userEvent.setup();
    await screen.findByTestId('state-node-Idle');
    await user.click(screen.getByRole('button', { name: 'Add state' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('State1'),
      'Added state State1',
    );
    const editor = await screen.findByRole('textbox', { name: 'State name' });
    await user.clear(editor);
    await user.type(editor, 'Done{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('Done'),
      'Renamed State1 → Done',
    );
    const inspector = await inspectorFor(['Busy']);
    await user.click(within(inspector).getByRole('button', { name: 'Delete' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.not.stringContaining('Busy'), 'Deleted Busy');
  });

  it('edits a transition label and reverses it', async () => {
    const { onChange } = renderEditor();
    const user = userEvent.setup();
    await screen.findByTestId('state-node-Idle');
    const inspector = await inspectorFor(['t1']);
    expect(within(inspector).getByRole('heading', { name: 'Transition' })).toBeTruthy();
    const label = within(inspector).getByLabelText('Label');
    await user.clear(label);
    await user.type(label, 'go{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('Idle --> Busy : go'),
      'Labelled transition Idle → Busy',
    );
    await user.click(within(inspector).getByRole('button', { name: 'Reverse' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('Busy --> Idle : go'),
      'Reversed transition Idle → Busy',
    );
  });

  it('shows composites and notes, and adds a concurrent region', async () => {
    const { onChange } = renderEditor({ code: NESTED });
    const user = userEvent.setup();
    expect(await screen.findByTestId('state-node-Active')).toBeTruthy();
    expect(screen.getByTestId('state-node-note:Idle:0').textContent).toContain('Waits here');
    const inspector = await inspectorFor(['Active']);
    expect(within(inspector).getByRole('heading', { name: 'Composite state' })).toBeTruthy();
    await user.click(within(inspector).getByRole('button', { name: 'Add concurrent region' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('--'),
      'Added region to Active',
    );
    expect(await screen.findByTestId('state-region-Active#1')).toBeTruthy();
  });

  it('edits a note and moves it to the other side', async () => {
    const { onChange } = renderEditor({ code: NESTED });
    const user = userEvent.setup();
    await screen.findByTestId('state-node-Idle');
    const inspector = await inspectorFor(['note:Idle:0']);
    await user.click(within(inspector).getByRole('radio', { name: 'Left of' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('note left of Idle : Waits here'),
      'Moved note',
    );
  });

  it('shows [*], many-item and id inspectors, and wraps and ungroups states', async () => {
    const { onChange } = renderEditor();
    const user = userEvent.setup();
    await screen.findByTestId('state-node-Idle');
    const start = await inspectorFor(['start:']);
    expect(within(start).getByText(/In Top level/)).toBeTruthy();
    const links = await inspectorFor(['t0', 't1']);
    expect(within(links).getByRole('heading', { name: '2 selected' })).toBeTruthy();
    expect(within(links).queryByRole('button', { name: 'Wrap in composite' })).toBeNull();
    expect(within(links).getByRole('button', { name: 'Delete' })).toBeTruthy();
    const many = await inspectorFor(['Idle', 'Busy']);
    expect(within(many).getByRole('heading', { name: '2 selected' })).toBeTruthy();
    await user.click(within(many).getByRole('button', { name: 'Wrap in composite' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('state Composite1 {'),
      'Wrapped 2 states in Composite1',
    );
    const composite = await screen.findByRole('region', { name: 'Inspector' });
    const id = within(composite).getByLabelText('Id');
    await user.clear(id);
    await user.type(id, 'Busy{Enter}');
    expect(within(composite).getByRole('alert')).toBeTruthy();
    await user.click(within(composite).getByRole('button', { name: 'Ungroup' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.not.stringContaining('Composite1'),
      'Ungrouped Composite1',
    );
  });

  it('is read-only while Claude edits, and keeps the last canvas on a syntax error', async () => {
    const { rerender } = renderEditor({ readOnlyReason: agentEditingText('Claude') });
    await screen.findByTestId('state-node-Idle');
    // Claude's working pill on the canvas says so; the editor shows no note of its own.
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add state' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    rerender({ readOnlyReason: null, code: `${CODE}    Busy -->\n` });
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe(SYNTAX_ERROR_REASON);
    });
    expect(screen.getByTestId('state-node-Busy')).toBeTruthy();
  });

  it('places new states from outside changes (typing, Claude, undo)', async () => {
    const { rerender } = renderEditor();
    await screen.findByTestId('state-node-Idle');
    rerender({ code: `${CODE}    Busy --> Later\n` });
    expect(await screen.findByTestId('state-node-Later')).toBeTruthy();
  });

  it('lays the canvas out again without writing code, and changes direction as one step', async () => {
    const { onChange } = renderEditor();
    const user = userEvent.setup();
    await screen.findByTestId('state-node-Idle');
    await user.click(screen.getByRole('button', { name: 'Auto layout' }));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('combobox', { name: 'Direction' }));
    await user.click(await screen.findByRole('option', { name: 'Left → right' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('direction LR'),
      'Changed direction to LR',
    );
  });

  it('shows a hint on an empty diagram', async () => {
    renderEditor({ code: 'stateDiagram-v2\n' });
    expect(await screen.findByText('Add a state from the toolbar to start')).toBeTruthy();
  });
});
