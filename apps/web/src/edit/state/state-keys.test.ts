import { describe, expect, it, vi } from 'vitest';

import { handleStateKey } from './state-keys.ts';
import { NO_SELECTION } from './state-types.ts';
import { stateContext } from '../../../tests/state-fixtures.ts';

import type { StateKeyDeps } from './state-keys.ts';
import type { StateSelection } from './state-types.ts';

function deps(selection: StateSelection, overrides: Partial<StateKeyDeps> = {}): StateKeyDeps {
  return {
    selection,
    context: stateContext(),
    isReadOnly: false,
    setEditingId: vi.fn(),
    setSelection: vi.fn(),
    fit: vi.fn(),
    ...overrides,
  };
}

function key(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', init);
}

describe('state canvas keys', () => {
  it('renames the one selected state, composite or note with Enter', () => {
    const one = deps({ ...NO_SELECTION, nodes: ['Idle'] });
    expect(handleStateKey(key({ key: 'Enter' }), one)).toBe(true);
    expect(one.setEditingId).toHaveBeenCalledWith('Idle');
    const frame = deps({ ...NO_SELECTION, group: 'Box' });
    expect(handleStateKey(key({ key: 'Enter' }), frame)).toBe(true);
    const note = deps({ ...NO_SELECTION, nodes: ['note:Idle:0'] });
    expect(handleStateKey(key({ key: 'Enter' }), note)).toBe(true);
    expect(
      handleStateKey(key({ key: 'Enter' }), deps({ ...NO_SELECTION, nodes: ['start:'] })),
    ).toBe(false);
    expect(
      handleStateKey(key({ key: 'Enter' }), deps({ ...NO_SELECTION, nodes: ['Idle', 'Busy'] })),
    ).toBe(false);
  });

  it('nudges the selection with the arrows (10 px with Shift), carrying notes along', () => {
    const one = deps({ ...NO_SELECTION, nodes: ['Idle'] });
    expect(handleStateKey(key({ key: 'ArrowRight', shiftKey: true }), one)).toBe(true);
    expect(one.context.positions.get().Idle).toMatchObject({ x: 10, y: 100 });
    expect(one.context.positions.get()['note:Idle:0']).toMatchObject({ x: 160, y: 100 });
    expect(handleStateKey(key({ key: 'ArrowUp' }), one)).toBe(true);
    expect(one.context.positions.get().Idle).toMatchObject({ x: 10, y: 99 });
    expect(handleStateKey(key({ key: 'ArrowUp' }), deps(NO_SELECTION))).toBe(false);
    expect(handleStateKey(key({ key: 'a' }), one)).toBe(false);
  });

  it('fits with ⇧1, clears with Esc, and edits nothing while read-only', () => {
    const one = deps({ ...NO_SELECTION, nodes: ['Idle'] }, { isReadOnly: true });
    expect(handleStateKey(key({ key: '!', code: 'Digit1', shiftKey: true }), one)).toBe(true);
    expect(one.fit).toHaveBeenCalled();
    expect(handleStateKey(key({ key: 'Escape' }), one)).toBe(false);
    expect(one.setSelection).toHaveBeenCalledWith(NO_SELECTION);
    expect(handleStateKey(key({ key: 'Enter' }), one)).toBe(false);
    const empty = deps(NO_SELECTION, {
      context: { ...stateContext(), getModel: (): null => null },
    });
    expect(handleStateKey(key({ key: 'Enter' }), empty)).toBe(false);
  });
});
