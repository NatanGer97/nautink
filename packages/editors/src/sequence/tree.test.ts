import { describe, expect, it } from 'vitest';

import { parse } from './model.ts';
import {
  containsItem,
  editList,
  isDescendantKey,
  listByKey,
  mapTree,
  pathOf,
  rangeBetween,
  siblingRange,
} from './tree.ts';
import { SEQUENCE_FIXTURES } from '../../tests/fixtures/sequence.ts';
import { parseOk } from '../../tests/parse-ok.ts';

import type { SequenceModel } from './types.ts';

const read = async (code: string): Promise<SequenceModel> => parseOk(parse, code);
// blocks fixture: i0 msg; i1 loop { i2 msg; i3 opt { i4 msg } }; i5 par { i6 } and { i7 }; ...
const blocks = async (): Promise<SequenceModel> => read(SEQUENCE_FIXTURES.blocks!);

describe('paths and lists', () => {
  it('finds the path to an item', async () => {
    const model = await blocks();
    expect(pathOf(model, 'i4')).toEqual([
      { key: 'root', index: 1, id: 'i1' },
      { key: 'i1:0', index: 1, id: 'i3' },
      { key: 'i3:0', index: 0, id: 'i4' },
    ]);
    expect(pathOf(model, 'nope')).toBeNull();
  });

  it('reads lists by key', async () => {
    const model = await blocks();
    expect(listByKey(model, 'root')).toBe(model.items);
    expect(listByKey(model, 'i5:1').map((item) => item.id)).toEqual(['i7']);
    expect(listByKey(model, 'i5:9')).toEqual([]);
    expect(listByKey(model, 'i0:0')).toEqual([]);
  });
});

describe('ranges', () => {
  it('lifts a range to the common list', async () => {
    const model = await blocks();
    expect(rangeBetween(model, 'i0', 'i5')).toEqual(['i0', 'i1', 'i5']);
    expect(rangeBetween(model, 'i4', 'i0')).toEqual(['i0', 'i1']);
    expect(rangeBetween(model, 'i1', 'i4')).toEqual(['i1']);
    expect(rangeBetween(model, 'i4', 'i1')).toEqual(['i1']);
    expect(rangeBetween(model, 'i6', 'i7')).toEqual(['i7']);
    expect(rangeBetween(model, 'nope', 'i0')).toEqual(['i0']);
  });

  it('accepts only contiguous siblings', async () => {
    const model = await blocks();
    expect(siblingRange(model, ['i1', 'i0'])).toEqual({ key: 'root', start: 0, end: 1 });
    expect(siblingRange(model, ['i0', 'i5'])).toBeNull();
    expect(siblingRange(model, ['i0', 'i2'])).toBeNull();
    expect(siblingRange(model, ['nope'])).toBeNull();
    expect(siblingRange(model, [])).toBeNull();
  });

  it('knows what is inside a block', async () => {
    const model = await blocks();
    const loop = model.items[1]!;
    expect(containsItem(loop, 'i4')).toBe(true);
    expect(containsItem(loop, 'i0')).toBe(false);
    expect(containsItem(model.items[0]!, 'i0')).toBe(false);
    expect(isDescendantKey(model, 'i1', 'i3:0')).toBe(true);
    expect(isDescendantKey(model, 'i1', 'i1:0')).toBe(true);
    expect(isDescendantKey(model, 'i5', 'i3:0')).toBe(false);
  });
});

describe('tree maps', () => {
  it('edits one list and maps the whole tree', async () => {
    const model = await blocks();
    const edited = editList(model.items, 'i3:0', (list) => list.slice(1));
    expect(listByKey({ ...model, items: edited }, 'i3:0')).toEqual([]);
    const dropped = mapTree(model.items, (item) => (item.t === 'msg' ? null : item));
    expect(dropped.every((item) => item.t === 'block')).toBe(true);
    const doubled = mapTree([model.items[0]!], (item) => [item, { ...item, id: `${item.id}b` }]);
    expect(doubled.map((item) => item.id)).toEqual(['i0', 'i0b']);
  });
});
