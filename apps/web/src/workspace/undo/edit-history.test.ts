import { describe, expect, it } from 'vitest';

import {
  amendEdit,
  canAmend,
  closeEditGroup,
  createEditStack,
  currentEntry,
  EDIT_HISTORY_CAP,
  jumpEdit,
  recordEdit,
  redoStep,
  TYPING_GROUP,
  undoStep,
} from './edit-history.ts';

import type { EditMeta, EditStack } from './edit-history.ts';

const OPENED: EditMeta = { label: 'Opened', source: 'open' };
const TYPED: EditMeta = { label: 'Typed in code', source: 'code', group: TYPING_GROUP };
const PASTED: EditMeta = { label: 'Pasted code', source: 'code' };

type At = [meta: EditMeta, now: number, cap?: number];

const record = (stack: EditStack, code: string, [meta, now, cap]: At): EditStack =>
  recordEdit(stack, code, { meta, options: cap === undefined ? { now } : { now, cap } });

const codes = (stack: EditStack): string[] => stack.entries.map((entry) => entry.code);

describe('recordEdit', () => {
  it('starts with one state that cannot be undone', () => {
    const stack = createEditStack('a', OPENED, 0);
    expect(currentEntry(stack)).toMatchObject({ code: 'a', label: 'Opened', isOpen: false });
    expect(undoStep(stack)).toBeUndefined();
    expect(redoStep(stack)).toBeUndefined();
  });

  it('ignores a change to the current code', () => {
    const stack = createEditStack('a', OPENED, 0);
    expect(record(stack, 'a', [PASTED, 10])).toBe(stack);
  });

  it('groups typing until a pause of a second', () => {
    let stack = createEditStack('a', OPENED, 0);
    stack = record(stack, 'ab', [TYPED, 100]);
    stack = record(stack, 'abc', [TYPED, 900]);
    stack = record(stack, 'abcd', [TYPED, 1800]);
    expect(codes(stack)).toEqual(['a', 'abcd']);
    stack = record(stack, 'abcde', [TYPED, 2900]);
    expect(codes(stack)).toEqual(['a', 'abcd', 'abcde']);
    expect(stack.entries[1]?.isOpen).toBe(false);
  });

  it('never merges typing into the opening state', () => {
    let stack = createEditStack('a', { ...OPENED, group: TYPING_GROUP }, 0);
    stack = record(stack, 'ab', [TYPED, 1]);
    expect(codes(stack)).toEqual(['a', 'ab']);
  });

  it('starts a new step after an explicit close (cursor jump, blur)', () => {
    let stack = record(createEditStack('a', OPENED, 0), 'ab', [TYPED, 1]);
    stack = closeEditGroup(stack);
    expect(closeEditGroup(stack)).toBe(stack);
    stack = record(stack, 'abc', [TYPED, 2]);
    expect(codes(stack)).toEqual(['a', 'ab', 'abc']);
  });

  it('makes a paste its own step, and typing after it a new one', () => {
    let stack = record(createEditStack('a', OPENED, 0), 'ab', [TYPED, 1]);
    stack = record(stack, 'abXY', [PASTED, 2]);
    stack = record(stack, 'abXYz', [TYPED, 3]);
    expect(stack.entries.map((entry) => entry.label)).toEqual([
      'Opened',
      'Typed in code',
      'Pasted code',
      'Typed in code',
    ]);
  });

  it('keeps the cursor of the latest merged keystroke', () => {
    const sel = { anchorLine: 1, anchorCol: 2, line: 1, col: 2 };
    let stack = record(createEditStack('a', OPENED, 0), 'ab', [TYPED, 1]);
    stack = record(stack, 'abc', [{ ...TYPED, sel }, 2]);
    expect(currentEntry(stack).sel).toEqual(sel);
    stack = record(stack, 'abcd', [TYPED, 3]);
    expect(currentEntry(stack).sel).toEqual(sel);
  });

  it('drops the redo branch on a new edit', () => {
    let stack = record(createEditStack('a', OPENED, 0), 'b', [PASTED, 1]);
    stack = record(stack, 'c', [PASTED, 2]);
    stack = jumpEdit(stack, 1).stack;
    stack = record(stack, 'd', [PASTED, 3]);
    expect(codes(stack)).toEqual(['a', 'b', 'd']);
    expect(redoStep(stack)).toBeUndefined();
  });

  it('does not merge typing after an undo', () => {
    let stack = record(createEditStack('a', OPENED, 0), 'ab', [TYPED, 1]);
    stack = record(stack, 'abc', [PASTED, 2]);
    stack = jumpEdit(stack, 1).stack;
    stack = record(stack, 'abz', [TYPED, 3]);
    expect(codes(stack)).toEqual(['a', 'ab', 'abz']);
  });

  it('keeps the newest steps under the cap, with unique ids', () => {
    let stack = createEditStack('0', OPENED, 0);
    for (let step = 1; step <= 5; step += 1) {
      stack = record(stack, String(step), [PASTED, step, 3]);
    }
    expect(codes(stack)).toEqual(['2', '3', '4', '5']);
    expect(stack.index).toBe(3);
    expect(new Set(stack.entries.map((entry) => entry.id)).size).toBe(4);
  });

  it('caps at 200 steps by default', () => {
    let stack = createEditStack('0', OPENED, 0);
    for (let step = 1; step <= EDIT_HISTORY_CAP + 10; step += 1) {
      stack = record(stack, String(step), [PASTED, step]);
    }
    expect(stack.entries).toHaveLength(EDIT_HISTORY_CAP + 1);
    expect(stack.entries[0]?.code).toBe('10');
  });
});

describe('jumpEdit', () => {
  const threeSteps = (): EditStack => {
    let stack = createEditStack('a', OPENED, 0);
    stack = record(stack, 'b', [{ label: 'Step b', source: 'visual' }, 1]);
    stack = record(stack, 'c', [{ label: 'Step c', source: 'claude' }, 2]);
    return record(stack, 'd', [{ label: 'Step d', source: 'code' }, 3]);
  };

  it('undoes several steps at once, newest first', () => {
    const jump = jumpEdit(threeSteps(), 1);
    expect(jump.code).toBe('b');
    expect(jump.direction).toBe('undo');
    expect(jump.crossed.map((entry) => entry.label)).toEqual(['Step d', 'Step c']);
    expect(undoStep(jump.stack)?.label).toBe('Step b');
    expect(redoStep(jump.stack)?.label).toBe('Step c');
  });

  it('redoes up to a later step, oldest first', () => {
    const back = jumpEdit(threeSteps(), 0).stack;
    const jump = jumpEdit(back, 2);
    expect(jump.direction).toBe('redo');
    expect(jump.code).toBe('c');
    expect(jump.crossed.map((entry) => entry.label)).toEqual(['Step b', 'Step c']);
  });

  it('closes the open typing group', () => {
    const typing = record(threeSteps(), 'de', [TYPED, 4]);
    const jump = jumpEdit(typing, 4);
    expect(jump.crossed).toEqual([]);
    expect(currentEntry(jump.stack).isOpen).toBe(false);
  });

  it('throws for an index outside the stack', () => {
    expect(() => jumpEdit(threeSteps(), 9)).toThrow(RangeError);
    expect(() => jumpEdit(threeSteps(), -1)).toThrow('No edit step at index -1');
    expect(() => jumpEdit(threeSteps(), 1.5)).toThrow(RangeError);
  });
});

describe('amendEdit', () => {
  const claudeTurn = (): EditStack =>
    record(createEditStack('a', OPENED, 0), 'b', [{ label: 'Claude: fix', source: 'claude' }, 1]);

  it('replaces the code of the newest step (an auto-fix retry)', () => {
    const stack = claudeTurn();
    const entryId = currentEntry(stack).id;
    expect(canAmend(stack, entryId)).toBe(true);
    const amended = amendEdit(stack, { entryId, code: 'c', now: 5 });
    expect(codes(amended)).toEqual(['a', 'c']);
    expect(currentEntry(amended)).toMatchObject({ label: 'Claude: fix', time: 5 });
  });

  it('drops the step when the amended code is the state before it', () => {
    const stack = claudeTurn();
    const amended = amendEdit(stack, { entryId: currentEntry(stack).id, code: 'a', now: 5 });
    expect(codes(amended)).toEqual(['a']);
    expect(amended.index).toBe(0);
  });

  it('refuses a step that is no longer the newest current one', () => {
    const stack = claudeTurn();
    const entryId = currentEntry(stack).id;
    const undone = jumpEdit(stack, 0).stack;
    expect(canAmend(undone, entryId)).toBe(false);
    expect(() => amendEdit(undone, { entryId, code: 'c', now: 5 })).toThrow('not the newest');
    expect(canAmend(createEditStack('a', OPENED, 0), 1)).toBe(false);
  });
});

describe('currentEntry', () => {
  it('throws for a corrupt index', () => {
    const stack = { ...createEditStack('a', OPENED, 0), index: 4 };
    expect(() => currentEntry(stack)).toThrow('outside its entries');
  });
});
