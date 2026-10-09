import { describe, expect, it } from 'vitest';

import { listKeyAction } from './list-keys.ts';

type Press = Pick<KeyboardEvent, 'key' | 'shiftKey'>;
type At = { ids: string[]; cursorId: string | null };

const press = (key: string, isShift = false): Press => ({ key, shiftKey: isShift });
const at = (cursorId: string | null): At => ({ ids: ['a', 'b'], cursorId });

describe('listKeyAction', () => {
  it('moves, opens, renames and opens the menu of the cursor row', () => {
    expect(listKeyAction(press('ArrowDown'), at('a'))).toEqual({ type: 'move', id: 'b' });
    expect(listKeyAction(press('Enter'), at('a'))).toEqual({ type: 'open', id: 'a' });
    expect(listKeyAction(press('F2'), at('b'))).toEqual({ type: 'rename', id: 'b' });
    expect(listKeyAction(press('F10', true), at('b'))).toEqual({ type: 'menu', id: 'b' });
    expect(listKeyAction(press('ContextMenu'), at('a'))).toEqual({ type: 'menu', id: 'a' });
    expect(listKeyAction(press('Escape'), at(null))).toEqual({ type: 'escape' });
  });

  it('ignores other keys and row keys without a cursor', () => {
    expect(listKeyAction(press('F10'), at('a'))).toBeUndefined();
    expect(listKeyAction(press('x'), at('a'))).toBeUndefined();
    expect(listKeyAction(press('Enter'), at(null))).toBeUndefined();
    expect(listKeyAction(press('Enter'), at('gone'))).toBeUndefined();
  });
});
