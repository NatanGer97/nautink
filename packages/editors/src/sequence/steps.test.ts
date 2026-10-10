import { describe, expect, it } from 'vitest';

import { parse } from './model.ts';
import { endSlot, slotAfter, stepItems } from './steps.ts';
import { listByKey } from './tree.ts';
import { SEQUENCE_FIXTURES } from '../../tests/fixtures/sequence.ts';
import { parseOk } from '../../tests/parse-ok.ts';

import type { SequenceModel } from './types.ts';

const read = async (code: string): Promise<SequenceModel> => parseOk(parse, code);
const ids = (model: SequenceModel, key: string = 'root'): string[] =>
  listByKey(model, key).map((item) => item.id);

// root: i0, i1 loop [i2, i3 opt [i4]], i5 par [i6] and [i7], i8 critical [i9] option [i10],
// i11 break [i12], i13 rect [i14]
const blocks = async (): Promise<SequenceModel> => read(SEQUENCE_FIXTURES.blocks!);

describe('slots', () => {
  it('finds the slot after an item, or the end', async () => {
    const model = await blocks();
    expect(slotAfter(model, 'i4')).toEqual({ key: 'i3:0', index: 1 });
    expect(slotAfter(model, 'nope')).toEqual({ key: 'root', index: 6 });
    expect(endSlot(model)).toEqual({ key: 'root', index: 6 });
  });
});

describe('stepItems', () => {
  it('steps past plain neighbours', async () => {
    const model = await read('sequenceDiagram\n    A->>B: one\n    A->>B: two\n');
    const down = stepItems(model, ['i0'], 1);
    expect(ids(down)).toEqual(['i1', 'i0']);
    expect(ids(stepItems(down, ['i0'], -1))).toEqual(['i0', 'i1']);
  });

  it('steps into the near end of a neighbouring block', async () => {
    const model = await blocks();
    expect(ids(stepItems(model, ['i0'], 1), 'i1:0')).toEqual(['i0', 'i2', 'i3']);
    expect(ids(stepItems(model, ['i8'], -1), 'i5:1')).toEqual(['i7', 'i8']);
  });

  it('steps between sections and out of blocks', async () => {
    const model = await blocks();
    expect(ids(stepItems(model, ['i6'], 1), 'i5:1')).toEqual(['i6', 'i7']);
    expect(ids(stepItems(model, ['i7'], -1), 'i5:0')).toEqual(['i6', 'i7']);
    expect(ids(stepItems(model, ['i2'], -1))).toEqual(['i0', 'i2', 'i1', 'i5', 'i8', 'i11', 'i13']);
    expect(ids(stepItems(model, ['i4'], 1), 'i1:0')).toEqual(['i2', 'i3', 'i4']);
  });

  it('moves several neighbours together, and stays put at the ends', async () => {
    const model = await blocks();
    expect(ids(stepItems(model, ['i11', 'i13'], -1), 'i8:1')).toEqual(['i10', 'i11', 'i13']);
    expect(stepItems(model, ['i0'], -1)).toBe(model);
    expect(stepItems(model, ['i13'], 1)).toBe(model);
    expect(stepItems(model, ['i0', 'i5'], 1)).toBe(model);
  });
});
