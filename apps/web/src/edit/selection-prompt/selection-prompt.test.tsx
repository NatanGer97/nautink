import { TooltipProvider } from '@nautink/ui/components/tooltip';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SelectionPrompt, promptPlaceholder } from './selection-prompt.tsx';
import { useSelectionPromptStore } from './use-selection-prompt.ts';
import { useChatStore } from '../../chat/chat-store.ts';
import { sendChat } from '../../chat/send-chat.ts';
import { ErEditor } from '../er/er-editor.tsx';
import { FlowEditor } from '../flow/flow-editor.tsx';
import { publishSelection, requestSelection } from '../selection/canvas-selection.ts';
import { SequenceEditor } from '../sequence/sequence-editor.tsx';

import type { SelectionPromptHandle } from './use-selection-prompt.ts';
import type { VisualEditorProps } from '../editor-props.ts';
import type { ReactElement } from 'react';

vi.mock('../positions/app-position-store.ts', async () => {
  const { MemoryPositionStore: Store } = await import('@nautink/visual-core/positions');
  return { appPositionStore: new Store() };
});

vi.mock('../../chat/send-chat.ts', () => ({
  canSendChat: (text: string): boolean => text.trim() !== '',
  sendChat: vi.fn(async (): Promise<boolean> => Promise.resolve(true)),
}));

const OVERLAY = { left: 0, top: 0, width: 1000, height: 700 };
const SELECTED = { left: 400, top: 200, width: 150, height: 40 };

function rect({ left, top, width, height }: typeof OVERLAY): DOMRect {
  return DOMRect.fromRect({ x: left, y: top, width, height });
}

/** jsdom has no layout: the overlay fills a 1000×700 canvas, every other element sits at SELECTED. */
function fakeLayout(): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element,
  ): DOMRect {
    if (this.hasAttribute('data-canvas-chrome')) {
      return rect({ left: 0, top: 0, width: 0, height: 0 });
    }
    return rect(this.classList.contains('pointer-events-none') ? OVERLAY : SELECTED);
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(300);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(42);
}

const ITEMS = [
  { id: 'a', label: 'Start', kind: 'node' },
  { id: 'b', label: 'Done', kind: 'node' },
];

function fakeHandle(group = vi.fn()): SelectionPromptHandle {
  return { selectedRects: () => [rect(SELECTED)], group };
}

function renderPrompt(element: ReactElement = <SelectionPrompt diagramId="d1" />): void {
  render(<TooltipProvider>{element}</TooltipProvider>);
}

beforeEach(() => {
  fakeLayout();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(sendChat).mockClear();
  useSelectionPromptStore.setState({ handle: null, canGroup: false, isReadOnly: true });
});

describe('promptPlaceholder', () => {
  it('counts many items and names one', () => {
    expect(promptPlaceholder(ITEMS)).toBe('Ask Claude about these 2…');
    expect(promptPlaceholder(ITEMS.slice(0, 1))).toBe('Ask Claude about this node…');
  });
});

describe('SelectionPrompt', () => {
  function showFor(overrides: { canGroup?: boolean; group?: () => void } = {}): void {
    useSelectionPromptStore.setState({
      handle: fakeHandle(vi.fn(overrides.group)),
      canGroup: overrides.canGroup ?? true,
      isReadOnly: false,
    });
    publishSelection('d1', ITEMS);
  }

  it('sits under the selection, centred', async () => {
    showFor();
    renderPrompt();
    const prompt = screen.getByTestId('selection-prompt');
    await waitFor(() => {
      expect(prompt.style.top).toBe('252px');
    });
    expect(prompt.style.left).toBe('325px');
    expect(prompt.classList.contains('invisible')).toBe(false);
    expect(screen.getByPlaceholderText('Ask Claude about these 2…')).toBeTruthy();
  });

  it('sends the question with the selection and clears it', async () => {
    showFor();
    renderPrompt();
    const user = userEvent.setup();
    const input = screen.getByLabelText('Ask Claude about the selection', { selector: 'input' });
    await user.type(input, 'Make these red{Enter}');
    expect(sendChat).toHaveBeenCalledWith('Make these red', {
      selection: { ids: ['a', 'b'], labels: ['Start', 'Done'], kinds: ['node', 'node'] },
    });
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('runs the editor’s Group, and hides Group where the editor has none', async () => {
    const group = vi.fn();
    showFor({ group });
    renderPrompt();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Group selection' }));
    expect(group).toHaveBeenCalledOnce();
    act(() => {
      useSelectionPromptStore.setState({ canGroup: false });
    });
    expect(screen.queryByRole('button', { name: 'Group selection' })).toBeNull();
  });

  it('hides while Claude is busy, while read-only, and with no editor', () => {
    showFor();
    renderPrompt();
    expect(screen.getByTestId('selection-prompt')).toBeTruthy();
    act(() => {
      useChatStore.setState({ busyDiagramId: 'another' });
    });
    expect(screen.queryByTestId('selection-prompt')).toBeNull();
    act(() => {
      useChatStore.setState({ busyDiagramId: null });
      useSelectionPromptStore.setState({ isReadOnly: true });
    });
    expect(screen.queryByTestId('selection-prompt')).toBeNull();
    act(() => {
      useSelectionPromptStore.setState({ isReadOnly: false, handle: null });
    });
    expect(screen.queryByTestId('selection-prompt')).toBeNull();
  });

  it('ignores another diagram’s selection', () => {
    showFor();
    renderPrompt(<SelectionPrompt diagramId="d2" />);
    expect(screen.queryByTestId('selection-prompt')).toBeNull();
  });

  it('hides on Esc until the selection changes', async () => {
    showFor();
    renderPrompt();
    const user = userEvent.setup();
    await user.click(
      screen.getByLabelText('Ask Claude about the selection', { selector: 'input' }),
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('selection-prompt')).toBeNull();
    act(() => {
      publishSelection('d1', ITEMS.slice(0, 1));
    });
    expect(screen.getByPlaceholderText('Ask Claude about this node…')).toBeTruthy();
  });
});

describe('editors with the floating prompt', () => {
  const PROPS: VisualEditorProps = {
    diagramId: 'd1',
    code: 'flowchart TD\n  A[Start] --> B[Done]\n',
    isDark: false,
    readOnlyReason: null,
    canSavePositions: true,
    onChange: () => undefined,
  };

  it('groups the selected flowchart nodes in a subgraph', async () => {
    const onChange = vi.fn();
    renderPrompt(
      <>
        <FlowEditor {...PROPS} onChange={onChange} />
        <SelectionPrompt diagramId="d1" />
      </>,
    );
    await screen.findByTestId('flow-node-A');
    act(() => {
      requestSelection('d1', ['A', 'B']);
    });
    const prompt = await screen.findByTestId('selection-prompt');
    await userEvent.setup().click(within(prompt).getByRole('button', { name: 'Group selection' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('subgraph'),
      'Grouped 2 nodes',
    );
  });

  it('has no Group in the ER editor', async () => {
    renderPrompt(
      <>
        <ErEditor {...PROPS} code={'erDiagram\n  CUSTOMER ||--o{ ORDER : places\n'} />
        <SelectionPrompt diagramId="d1" />
      </>,
    );
    await screen.findByText('CUSTOMER');
    act(() => {
      requestSelection('d1', ['CUSTOMER']);
    });
    const prompt = await screen.findByTestId('selection-prompt');
    expect(within(prompt).queryByRole('button', { name: 'Group selection' })).toBeNull();
  });

  it('follows a selected sequence participant, with no Group', async () => {
    renderPrompt(
      <>
        <SequenceEditor {...PROPS} code={'sequenceDiagram\n  Alice->>Bob: Hi\n'} />
        <SelectionPrompt diagramId="d1" />
      </>,
    );
    await screen.findByTestId('sequence-participant-Alice');
    act(() => {
      requestSelection('d1', ['Alice']);
    });
    const prompt = await screen.findByTestId('selection-prompt');
    expect(within(prompt).queryByRole('button', { name: 'Group selection' })).toBeNull();
    const rects = useSelectionPromptStore.getState().handle?.selectedRects() ?? [];
    expect(rects).toHaveLength(1);
  });

  it('stays hidden while the editor is read-only', async () => {
    renderPrompt(
      <>
        <FlowEditor {...PROPS} readOnlyReason="Claude is editing this diagram." />
        <SelectionPrompt diagramId="d1" />
      </>,
    );
    await screen.findByTestId('flow-node-A');
    act(() => {
      requestSelection('d1', ['A']);
    });
    await waitFor(() => {
      expect(useSelectionPromptStore.getState().handle).not.toBeNull();
    });
    expect(screen.queryByTestId('selection-prompt')).toBeNull();
  });
});
