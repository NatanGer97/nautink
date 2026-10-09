import { describe, expect, it, vi } from 'vitest';

import { handleFlowKey } from './flow-keys.ts';
import { NO_SELECTION } from './flow-types.ts';
import { testContext } from '../../../tests/flow-fixtures.ts';

import type { FlowKeyDeps } from './flow-keys.ts';

function deps(overrides: Partial<FlowKeyDeps> = {}): FlowKeyDeps {
  return {
    selection: { ...NO_SELECTION, nodes: ['A'] },
    context: testContext(),
    isReadOnly: false,
    setEditingId: vi.fn(),
    setSelection: vi.fn(),
    move: vi.fn(),
    fit: vi.fn(),
    ...overrides,
  };
}

function key(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', init);
}

describe('flowchart keys', () => {
  it('renames with Enter, duplicates with ⌘D and nudges with the arrows', () => {
    const keys = deps();
    expect(handleFlowKey(key({ key: 'Enter' }), keys)).toBe(true);
    expect(keys.setEditingId).toHaveBeenCalledWith('A');
    expect(handleFlowKey(key({ key: 'd', metaKey: true }), keys)).toBe(true);
    expect(keys.context.getGraph()?.nodes.at(-1)?.id).toBe('n1');
    expect(handleFlowKey(key({ key: 'ArrowLeft' }), keys)).toBe(true);
    expect(handleFlowKey(key({ key: 'ArrowDown', shiftKey: true }), keys)).toBe(true);
    expect(keys.move).toHaveBeenNthCalledWith(1, ['A'], { x: -1, y: 0 });
    expect(keys.move).toHaveBeenNthCalledWith(2, ['A'], { x: 0, y: 10 });
    expect(handleFlowKey(key({ key: 'x' }), keys)).toBe(false);
  });

  it('fits with ⇧1, clears with Esc, and changes nothing while read-only', () => {
    const keys = deps({ isReadOnly: true });
    expect(handleFlowKey(key({ key: '!', code: 'Digit1', shiftKey: true }), keys)).toBe(true);
    expect(keys.fit).toHaveBeenCalled();
    expect(handleFlowKey(key({ key: 'Escape' }), keys)).toBe(false);
    expect(keys.setSelection).toHaveBeenCalledWith(NO_SELECTION);
    expect(handleFlowKey(key({ key: 'Enter' }), keys)).toBe(false);
    expect(keys.setEditingId).toHaveBeenCalledWith(null);
  });

  it('leaves the arrows to React Flow when a node has focus, and needs a selection', () => {
    const node = document.createElement('div');
    node.className = 'react-flow__node';
    const event = key({ key: 'ArrowUp' });
    Object.defineProperty(event, 'target', { value: node });
    const keys = deps();
    expect(handleFlowKey(event, keys)).toBe(false);
    expect(handleFlowKey(key({ key: 'ArrowUp' }), deps({ selection: NO_SELECTION }))).toBe(false);
    expect(handleFlowKey(key({ key: 'd', ctrlKey: true }), deps({ selection: NO_SELECTION }))).toBe(
      false,
    );
  });
});
