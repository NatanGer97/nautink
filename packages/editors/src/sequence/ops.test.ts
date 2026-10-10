import { describe, expect, it } from 'vitest';

import { emptyModel, findItem, parse, serialize } from './model.ts';
import {
  addSection,
  deleteItems,
  fixLifecycle,
  insertItem,
  moveItems,
  newMessage,
  newNote,
  normalizeOrder,
  removeSection,
  reverseMessage,
  setAutonumberStart,
  setBlockKind,
  setSectionLabel,
  toggleAutonumber,
  unwrap,
  updateItem,
  wrapItems,
} from './ops.ts';
import { listByKey } from './tree.ts';
import { SEQUENCE_FIXTURES } from '../../tests/fixtures/sequence.ts';
import { parseOk } from '../../tests/parse-ok.ts';

import type { BlockItem, SequenceModel } from './types.ts';

const read = async (code: string): Promise<SequenceModel> => parseOk(parse, code);
const blockOf = (model: SequenceModel, id: string): BlockItem => {
  const item = findItem(model, id)!.item;
  if (item.t !== 'block') {
    throw new Error(`${id} is not a block`);
  }
  return item;
};
const ids = (model: SequenceModel, key: string = 'root'): string[] =>
  listByKey(model, key).map((item) => item.id);

describe('items', () => {
  it('creates new messages and notes', () => {
    expect(newMessage('A', 'B', { text: 'x' })).toMatchObject({
      t: 'msg',
      from: 'A',
      to: 'B',
      text: 'x',
      head: 'arrow',
    });
    expect(newNote(['A'])).toMatchObject({
      t: 'note',
      placement: 'right',
      text: 'Note',
      actors: ['A'],
    });
  });

  it('inserts, updates, deletes and reverses items', async () => {
    const model = await read(SEQUENCE_FIXTURES.minimal!);
    const inserted = insertItem(
      model,
      { key: 'root', index: 0 },
      { ...newNote(['Alice']), id: 'n' },
    );
    expect(ids(inserted)).toEqual(['n', 'i0']);
    expect(updateItem(model, 'i0', { text: 'Hey' }).items[0]).toMatchObject({ text: 'Hey' });
    expect(updateItem(model, 'i0', (item) => ({ text: `${item.id}!` })).items[0]).toMatchObject({
      text: 'i0!',
    });
    expect(deleteItems(model, ['i0']).items).toEqual([]);
    expect(reverseMessage(model, 'i0').items[0]).toMatchObject({ from: 'Bob', to: 'Alice' });
    const noted = insertItem(model, { key: 'root', index: 1 }, { ...newNote(['Alice']), id: 'n' });
    expect(reverseMessage(noted, 'n')).toEqual(noted);
  });

  it('moves items between lists, never into themselves', async () => {
    const model = await read(SEQUENCE_FIXTURES.blocks!);
    expect(ids(moveItems(model, ['i0'], { key: 'i1:0', index: 0 }), 'i1:0')).toEqual([
      'i0',
      'i2',
      'i3',
    ]);
    expect(ids(moveItems(model, ['i0'], { key: 'root', index: 3 }))).toEqual([
      'i1',
      'i5',
      'i0',
      'i8',
      'i11',
      'i13',
    ]);
    expect(moveItems(model, ['i1'], { key: 'i3:0', index: 0 })).toBe(model);
    expect(moveItems(model, ['i1'], { key: 'i1:0', index: 0 })).toBe(model);
    expect(moveItems(model, ['nope'], { key: 'root', index: 0 })).toBe(model);
    expect(ids(moveItems(model, ['i1', 'i2'], { key: 'root', index: 0 }))[0]).toBe('i1');
  });
});

describe('blocks', () => {
  it('wraps contiguous items, or adds an empty block', async () => {
    const model = await read(SEQUENCE_FIXTURES.blocks!);
    const { model: wrapped, id } = wrapItems(model, ['i0', 'i1'], 'alt');
    const block = blockOf(wrapped, id);
    expect(block.sections.map((section) => [section.label, section.items.length])).toEqual([
      ['success', 2],
      ['failure', 0],
    ]);
    const added = wrapItems(model, [], 'rect');
    expect(blockOf(added.model, added.id).sections).toEqual([
      { label: 'rgba(127, 127, 255, 0.15)', items: [] },
    ]);
    const loop = wrapItems(model, ['i0', 'i5'], 'loop');
    expect(blockOf(loop.model, loop.id).sections).toEqual([{ label: 'every second', items: [] }]);
  });

  it('unwraps a block in place', async () => {
    const model = await read(SEQUENCE_FIXTURES.blocks!);
    expect(ids(unwrap(model, 'i1'))).toEqual(['i0', 'i2', 'i3', 'i5', 'i8', 'i11', 'i13']);
    expect(unwrap(model, 'i0')).toEqual(model);
  });

  it('changes block kinds, merging sections when needed', async () => {
    const model = await read(SEQUENCE_FIXTURES.blocks!);
    const loop = blockOf(setBlockKind(model, 'i5', 'loop'), 'i5');
    expect(loop.sections.map((section) => section.items.length)).toEqual([2]);
    expect(blockOf(setBlockKind(model, 'i1', 'rect'), 'i1').sections[0]!.label).toBe(
      'rgba(127, 127, 255, 0.15)',
    );
    expect(blockOf(setBlockKind(model, 'i13', 'opt'), 'i13').sections[0]!.label).toBe('optional');
    expect(blockOf(setBlockKind(model, 'i5', 'alt'), 'i5').sections).toHaveLength(2);
    expect(setBlockKind(model, 'i0', 'loop')).toEqual(model);
  });

  it('edits sections', async () => {
    const model = await read(SEQUENCE_FIXTURES.blocks!);
    expect(
      blockOf(setSectionLabel(model, { blockId: 'i5', sectionIndex: 1, label: 'x' }), 'i5')
        .sections[1]!.label,
    ).toBe('x');
    expect(blockOf(addSection(model, 'i5'), 'i5').sections.at(-1)).toEqual({
      label: 'meanwhile',
      items: [],
    });
    const removed = blockOf(removeSection(model, { blockId: 'i5', sectionIndex: 1 }), 'i5');
    expect(removed.sections.map((section) => section.items.length)).toEqual([2]);
    expect(removeSection(model, { blockId: 'i5', sectionIndex: 0 })).toEqual(model);
    expect(blockOf(addSection(model, 'i1'), 'i1').sections.at(-1)).toEqual({
      label: '',
      items: [],
    });
  });
});

describe('autonumber', () => {
  it('sets or clears where an autonumber row restarts', async () => {
    const model = await read(
      `${SEQUENCE_FIXTURES.minimal!}    autonumber 5 2\n    Bob->>Alice: Ho\n`,
    );
    const row = model.items[1]!;
    expect(findItem(setAutonumberStart(model, row.id, 9), row.id)!.item).toEqual({
      t: 'autonumber',
      id: row.id,
      isVisible: true,
      start: 9,
      step: 2,
    });
    const cleared = findItem(setAutonumberStart(model, row.id, undefined), row.id)!.item;
    expect(cleared).toEqual({ t: 'autonumber', id: row.id, isVisible: true, step: 2 });
    expect(setAutonumberStart(model, 'i0', 3).items[0]).toBe(model.items[0]);
  });

  it('toggles the leading autonumber', () => {
    const on = toggleAutonumber(emptyModel());
    expect(on.autonumber).toEqual({ isVisible: true });
    expect(toggleAutonumber(on).autonumber).toBeNull();
  });
});

describe('lifecycle', () => {
  it('keeps valid create and destroy markers', async () => {
    const model = await read(SEQUENCE_FIXTURES.lifecycle!);
    expect(fixLifecycle(model)).toBe(model);
  });

  it('turns a creation that no longer comes first into a normal participant', async () => {
    const model = await read(SEQUENCE_FIXTURES.lifecycle!);
    const early = insertItem(model, { key: 'root', index: 0 }, { ...newNote(['C']), id: 'n' });
    expect(
      early.participants.map((participant) => [participant.id, participant.isCreated]),
    ).toEqual([
      ['A', false],
      ['B', false],
      ['C', false],
      ['D', true],
    ]);
    expect(serialize(early)).toContain('    participant C as Carl\n');
  });

  it('drops destroy markers for participants a message does not involve', async () => {
    const model = await read(SEQUENCE_FIXTURES.lifecycle!);
    const moved = updateItem(model, 'i3', { from: 'A', to: 'B' });
    expect(findItem(moved, 'i3')!.item).toMatchObject({ destroy: [] });
  });

  it('looks through every item kind for references', async () => {
    const model = await read(
      `${SEQUENCE_FIXTURES.lifecycle!}    autonumber\n    loop x\n        activate A\n    end\n`,
    );
    expect(fixLifecycle(model)).toBe(model);
  });

  it('orders created participants by their creating message', async () => {
    const model = await read(SEQUENCE_FIXTURES.lifecycle!);
    const shuffled = { ...model, participants: [...model.participants].reverse() };
    expect(normalizeOrder(shuffled).participants.map((participant) => participant.id)).toEqual([
      'B',
      'A',
      'C',
      'D',
    ]);
    const extra = {
      ...model,
      participants: [
        ...model.participants,
        { id: 'Z', label: 'Z', kind: 'participant' as const, box: null, isCreated: true },
      ],
    };
    expect(normalizeOrder(extra).participants.at(-1)!.id).toBe('Z');
  });
});
