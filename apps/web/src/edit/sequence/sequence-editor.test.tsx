import { TooltipProvider } from '@nautink/ui/components/tooltip';
import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SequenceEditor } from './sequence-editor.tsx';
import { DARK_CODE_SVG_FILL } from '../canvas/code-colors.ts';
import { CLAUDE_EDITING } from '../read-only-reason.ts';
import { requestSelection, useCanvasSelectionStore } from '../selection/canvas-selection.ts';
import { SYNTAX_ERROR_REASON } from '../use-editor-core.ts';

import type { VisualEditorProps } from '../editor-props.ts';

const CODE = 'sequenceDiagram\n    participant A as Alice\n    A->>B: Hello\n';

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
      <SequenceEditor {...props} />
    </TooltipProvider>,
  );
  return {
    onChange,
    rerender: (next): void => {
      view.rerender(
        <TooltipProvider>
          <SequenceEditor {...props} {...next} />
        </TooltipProvider>,
      );
    },
  };
}

function inspector(): HTMLElement {
  return screen.getByRole('region', { name: 'Inspector' });
}

const RICH = [
  'sequenceDiagram',
  '    title Checkout',
  '    box Aqua Front',
  '        actor U as User',
  '        participant W',
  '    end',
  '    participant Q@{ "type": "queue" }',
  '    participant D@{ "type": "database" }',
  '    participant K@{ "type": "collections" }',
  '    participant N@{ "type": "control" }',
  '    participant E@{ "type": "entity" }',
  '    participant Y@{ "type": "boundary" }',
  '    autonumber',
  '    U->>+W: open',
  '    W-)Q: send',
  '    W->>()D: central',
  '    W-xW: self',
  '    W--)-U: done',
  '    activate D',
  '    deactivate D',
  '    create participant T as Temp',
  '    W->>T: make',
  '    destroy T',
  '    T-->>W: bye',
  '    alt good',
  '        Note over U,W: both',
  '    else bad',
  '        D-|\\Q: half',
  '    end',
  '    rect rgb(1, 2, 3)',
  '        autonumber off',
  '    end',
  '',
].join('\n');

function clickRow(element: Element): void {
  fireEvent.pointerDown(element, { button: 0, clientX: 5, clientY: 5 });
  fireEvent.pointerUp(window, { clientX: 5, clientY: 5 });
}

/** The drawn text of a row on the canvas (presses on it bubble to the row's handlers). */
function rowWith(text: string): Element {
  const found = within(screen.getByTestId('sequence-canvas')).getAllByText(text)[0];
  if (found === undefined) {
    throw new Error(`No row with ${text}`);
  }
  return found;
}

describe('SequenceEditor', () => {
  it('draws every participant kind, row kind and block, with an inspector for each', async () => {
    const { onChange } = renderEditor({ code: RICH });
    const user = userEvent.setup();
    expect(await screen.findByTestId('sequence-participant-Y')).toBeTruthy();
    expect(screen.queryByTestId('sequence-footer-T')).toBeNull();
    clickRow(rowWith('both'));
    expect(within(inspector()).getByRole('heading', { name: 'Note' })).toBeTruthy();
    await user.click(within(inspector()).getByRole('radio', { name: 'Right of' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('Note right of U: both'),
      'Edited note on User, W',
    );
    clickRow(rowWith('activate'));
    expect(within(inspector()).getByRole('heading', { name: 'Activate' })).toBeTruthy();
    clickRow(rowWith('autonumber off'));
    expect(within(inspector()).getByRole('heading', { name: 'Autonumber' })).toBeTruthy();
    clickRow(rowWith('alt'));
    expect(within(inspector()).getByRole('heading', { name: 'Block' })).toBeTruthy();
    expect(within(inspector()).getByLabelText('else 1')).toBeTruthy();
    clickRow(rowWith('rect'));
    expect(within(inspector()).getByLabelText('Background')).toBeTruthy();
    const background = screen
      .getByTestId('sequence-canvas')
      .querySelector('rect[fill="rgb(1, 2, 3)"]');
    expect(background?.getAttribute('class')).toBe(DARK_CODE_SVG_FILL);
    fireEvent.pointerDown(screen.getByTestId('sequence-box-box1'), { button: 0 });
    expect(within(inspector()).getByRole('heading', { name: 'Box' })).toBeTruthy();
    clickRow(rowWith('open'));
    fireEvent.pointerDown(rowWith('done'), { button: 0, clientX: 5, clientY: 5, shiftKey: true });
    fireEvent.pointerUp(window, { clientX: 5, clientY: 5 });
    expect(within(inspector()).getByRole('heading', { name: '5 rows' })).toBeTruthy();
  });

  it('edits participants and boxes through their panels', async () => {
    const { onChange } = renderEditor({ code: RICH });
    const user = userEvent.setup();
    await screen.findByTestId('sequence-participant-W');
    act(() => {
      requestSelection('d1', ['W']);
    });
    await user.click(within(inspector()).getByRole('button', { name: 'Database' }));
    expect(onChange.mock.lastCall?.[1]).toBe('Changed kind of W');
    const id = within(inspector()).getByLabelText('Id (used in code)');
    await user.clear(id);
    await user.type(id, 'Web{Enter}');
    expect(onChange.mock.lastCall?.[1]).toBe('Renamed W → Web');
    await user.click(within(inspector()).getByRole('combobox', { name: 'Box' }));
    await user.click(await screen.findByRole('option', { name: 'None' }));
    expect(onChange.mock.lastCall?.[1]).toBe('Moved Web out of its box');
    fireEvent.pointerDown(screen.getByTestId('sequence-box-box1'), { button: 0 });
    const title = within(inspector()).getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Clients{Enter}');
    expect(onChange.mock.lastCall?.[1]).toBe('Renamed Front → Clients');
  });

  it('edits messages and blocks through their panels', async () => {
    const { onChange } = renderEditor({ code: RICH.replace(/\bW\b/g, 'Web') });
    const user = userEvent.setup();
    await screen.findByTestId('sequence-participant-Web');
    clickRow(rowWith('send'));
    await user.click(within(inspector()).getByRole('button', { name: 'Cross' }));
    expect(onChange.mock.lastCall?.[0]).toContain('Web-xQ: send');
    await user.click(within(inspector()).getByRole('button', { name: 'Reverse' }));
    expect(onChange.mock.lastCall?.[0]).toContain('Q-xWeb: send');
    await user.click(within(inspector()).getByRole('button', { name: 'Add note' }));
    expect(onChange.mock.lastCall?.[1]).toBe('Added note on Web');
    clickRow(rowWith('alt'));
    await user.click(within(inspector()).getByRole('button', { name: 'Add else' }));
    expect(onChange.mock.lastCall?.[1]).toBe('Added section to alt block');
    await user.click(within(inspector()).getAllByRole('button', { name: /^Remove this else/ })[1]!);
    expect(onChange.mock.lastCall?.[1]).toBe('Removed section from alt block');
    await user.click(within(inspector()).getByRole('button', { name: 'Unwrap' }));
    expect(onChange.mock.lastCall?.[1]).toBe('Unwrapped alt');
  });

  it('edits text in place with a double-click, and cancels with Escape', async () => {
    const { onChange } = renderEditor();
    const user = userEvent.setup();
    await user.dblClick(await screen.findByText('Hello'));
    const field = screen.getByRole('textbox', { name: 'Message text' });
    await user.type(field, '{Escape}');
    expect(screen.queryByRole('textbox', { name: 'Message text' })).toBeNull();
    await user.dblClick(within(screen.getByTestId('sequence-canvas')).getByText('Hello'));
    await user.clear(screen.getByRole('textbox', { name: 'Message text' }));
    await user.type(screen.getByRole('textbox', { name: 'Message text' }), 'Hey{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('A->>B: Hey'),
      'Edited text of message Alice → B',
    );
  });

  it('adds from the library and drops tools on the canvas', async () => {
    const { onChange } = renderEditor();
    const user = userEvent.setup();
    await screen.findByTestId('sequence-participant-A');
    await user.click(screen.getByRole('button', { name: 'Library' }));
    const library = screen.getByRole('region', { name: 'Library' });
    await user.click(within(library).getByRole('button', { name: 'Entity' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('participant Entity@{ "type": "entity" }'),
      'Added entity Entity',
    );
    await user.click(within(library).getByRole('tab', { name: 'Blocks' }));
    await user.click(within(library).getByRole('button', { name: /^Par/ }));
    expect(onChange.mock.lastCall?.[1]).toMatch(/^(Added par block|Wrapped 1 row in par)$/);
    await user.click(within(library).getByRole('button', { name: 'Close library' }));
    const canvas = screen.getByTestId('sequence-canvas');
    const drop = createEvent.drop(canvas);
    // jsdom has no DragEvent: give the plain event what a browser drop carries.
    Object.defineProperties(drop, {
      dataTransfer: { value: { getData: (): string => 'note' } },
      clientX: { value: 0 },
      clientY: { value: 0 },
    });
    fireEvent(canvas, drop);
    expect(onChange.mock.lastCall?.[1]).toMatch(/^Added note on /);
  });

  it('puts several participants in a box, or deletes them, from one inspector', async () => {
    const { onChange } = renderEditor({
      code: 'sequenceDiagram\n    participant A as Alice\n    participant C\n    A->>B: Hello\n',
    });
    await screen.findByTestId('sequence-participant-A');
    fireEvent.pointerDown(screen.getByTestId('sequence-participant-A'), { button: 0 });
    fireEvent.pointerUp(window);
    fireEvent.pointerDown(screen.getByTestId('sequence-participant-B'), {
      button: 0,
      shiftKey: true,
    });
    fireEvent.pointerUp(window);
    expect(within(inspector()).getByRole('heading', { name: '2 participants' })).toBeTruthy();
    expect(within(inspector()).getByRole('button', { name: 'Delete' })).toBeTruthy();
    fireEvent.click(within(inspector()).getByRole('button', { name: 'Put in a box' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringMatching(/box Group\n\s+participant A as Alice\n\s+participant B\n\s+end/),
      'Put Alice, B in a box',
    );
    expect(within(inspector()).getByRole('heading', { name: 'Box' })).toBeTruthy();
  });

  it('draws participants and messages, and renames a participant from the inspector', async () => {
    const { onChange } = renderEditor();
    const user = userEvent.setup();
    const alice = await screen.findByTestId('sequence-participant-A');
    expect(within(alice).getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Hello')).toBeTruthy();
    act(() => {
      requestSelection('d1', ['A']);
    });
    expect(within(inspector()).getByRole('heading', { name: 'Participant' })).toBeTruthy();
    const name = within(inspector()).getByLabelText('Display name');
    await user.clear(name);
    await user.type(name, 'Ann{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('participant A as Ann'),
      'Renamed Alice → Ann',
    );
    expect(useCanvasSelectionStore.getState().items).toEqual([
      { id: 'A', label: 'Ann', kind: 'participant' },
    ]);
  });

  it('adds a participant from the toolbar and opens its name for typing', async () => {
    const { onChange } = renderEditor();
    const user = userEvent.setup();
    await screen.findByTestId('sequence-participant-A');
    await user.click(screen.getByRole('button', { name: 'Add actor' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('actor Actor'),
      'Added actor Actor',
    );
    const field = screen.getByRole('textbox', { name: 'Participant name' });
    await user.clear(field);
    await user.type(field, 'Customer{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('actor Actor as Customer'),
      'Renamed Actor → Customer',
    );
  });

  it('selects a message by clicking it, edits it, and deletes it with the keyboard', async () => {
    const { onChange } = renderEditor();
    const user = userEvent.setup();
    const message = (await screen.findByText('Hello')).closest('[data-testid^="sequence-item-"]');
    expect(message).not.toBeNull();
    fireEvent.pointerDown(message!, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(window, { clientX: 10, clientY: 10 });
    expect(within(inspector()).getByRole('heading', { name: 'Message' })).toBeTruthy();
    await user.click(within(inspector()).getByRole('radio', { name: 'Dotted' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('A-->>B: Hello'),
      'Changed line style of message Alice → B',
    );
    await user.click(document.body);
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.not.stringContaining('Hello'),
      'Deleted message Alice → B',
    );
  });

  it('wraps a message in a loop and toggles autonumber', async () => {
    const { onChange } = renderEditor();
    const user = userEvent.setup();
    const message = (await screen.findByText('Hello')).closest('[data-testid^="sequence-item-"]');
    fireEvent.pointerDown(message!, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(window, { clientX: 10, clientY: 10 });
    await user.click(within(inspector()).getByRole('button', { name: 'Wrap in loop' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('loop every second'),
      'Wrapped 1 row in loop',
    );
    expect(within(inspector()).getByRole('heading', { name: 'Block' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Number the messages (autonumber)' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('autonumber'),
      'Turned autonumber on',
    );
  });

  it('is read-only while Claude edits, and keeps the last canvas on a syntax error', async () => {
    const { rerender } = renderEditor({ readOnlyReason: CLAUDE_EDITING });
    await screen.findByTestId('sequence-participant-A');
    expect(screen.getByRole('status').textContent).toBe(CLAUDE_EDITING);
    expect(screen.getByRole('button', { name: 'Add actor' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(screen.queryByTestId('sequence-lifeline-A')).toBeNull();
    rerender({ readOnlyReason: null, code: `${CODE}    A->>\n` });
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe(SYNTAX_ERROR_REASON);
    });
    expect(screen.getByTestId('sequence-participant-A')).toBeTruthy();
  });

  it('shows outside changes and hints on an empty diagram', async () => {
    const { rerender } = renderEditor({ code: 'sequenceDiagram\n' });
    expect(await screen.findByText(/Add a participant or actor/)).toBeTruthy();
    rerender({ code: CODE });
    expect(await screen.findByTestId('sequence-participant-B')).toBeTruthy();
  });
});
