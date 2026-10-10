import { describe, expect, it, vi } from 'vitest';

import { handleErKey } from './er-keys.ts';
import { NO_SELECTION } from './er-types.ts';

import type { ErKeyDeps } from './er-keys.ts';
import type { ErCanvasSelection } from './er-types.ts';

function deps(selection: ErCanvasSelection, isReadOnly: boolean = false): ErKeyDeps {
  return {
    selection,
    isReadOnly,
    setEditingId: vi.fn(),
    setSelection: vi.fn(),
    move: vi.fn(),
    fit: vi.fn(),
  };
}

function key(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', init);
}

describe('handleErKey', () => {
  it('renames the one selected entity, or else the one relationship, with Enter', () => {
    const entity = deps({ ...NO_SELECTION, entities: ['A'] });
    expect(handleErKey(key({ key: 'Enter' }), entity)).toBe(true);
    expect(entity.setEditingId).toHaveBeenCalledWith('A');
    const rel = deps({ ...NO_SELECTION, rels: ['R_A_B_0'] });
    expect(handleErKey(key({ key: 'Enter' }), rel)).toBe(true);
    expect(rel.setEditingId).toHaveBeenCalledWith('R_A_B_0');
    expect(
      handleErKey(key({ key: 'Enter' }), deps({ ...NO_SELECTION, entities: ['A', 'B'] })),
    ).toBe(false);
  });

  it('nudges selected entities by 1 px, or 10 px with Shift', () => {
    const state = deps({ ...NO_SELECTION, entities: ['A'] });
    handleErKey(key({ key: 'ArrowRight' }), state);
    handleErKey(key({ key: 'ArrowUp', shiftKey: true }), state);
    expect(state.move).toHaveBeenNthCalledWith(1, ['A'], { x: 1, y: 0 });
    expect(state.move).toHaveBeenNthCalledWith(2, ['A'], { x: 0, y: -10 });
    expect(handleErKey(key({ key: 'ArrowLeft' }), deps(NO_SELECTION))).toBe(false);
    expect(handleErKey(key({ key: 'x' }), state)).toBe(false);
  });

  it('leaves arrows on a focused node to React Flow', () => {
    const node = document.createElement('div');
    node.className = 'react-flow__node';
    document.body.append(node);
    const event = key({ key: 'ArrowDown', bubbles: true });
    Object.defineProperty(event, 'target', { value: node });
    expect(handleErKey(event, deps({ ...NO_SELECTION, entities: ['A'] }))).toBe(false);
    node.remove();
  });

  it('fits with ⇧1, clears with Esc, and edits nothing while read-only', () => {
    const state = deps({ ...NO_SELECTION, entities: ['A'] }, true);
    expect(handleErKey(key({ code: 'Digit1', key: '!', shiftKey: true }), state)).toBe(true);
    expect(state.fit).toHaveBeenCalled();
    expect(handleErKey(key({ key: 'Escape' }), state)).toBe(false);
    expect(state.setSelection).toHaveBeenCalledWith(NO_SELECTION);
    expect(handleErKey(key({ key: 'Enter' }), state)).toBe(false);
  });
});
