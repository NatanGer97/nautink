// Locks the sequence diagram port to v1's exact output: round trips, edit ops and layout geometry.
import { describe, expect, it } from 'vitest';

import { computeLayout } from './layout.ts';
import { parse, serialize, walkItems } from './model.ts';
import * as sequenceOps from './ops.ts';
import * as participantOps from './participants.ts';
import golden from '../../tests/golden/sequence.json' with { type: 'json' };
import {
  measure,
  normalizeLayout,
  parseModel,
  roundTrip,
  runSteps,
} from '../../tests/golden-runner.ts';

import type { ItemVisit } from './model.ts';
import type { SequenceModel } from './types.ts';
import type {
  GoldenEditor,
  GoldenFile,
  LayoutCase,
  OpCase,
  RoundTripCase,
} from '../../tests/golden-runner.ts';

function itemIds(model: SequenceModel): string[] {
  const ids: string[] = [];
  walkItems(model.items, (entry: ItemVisit) => ids.push(entry.item.id));
  return ids;
}

const FILE: GoldenFile = golden;
const EDITOR: GoldenEditor<SequenceModel> = {
  parse,
  serialize,
  ops: [sequenceOps, participantOps],
  itemIds,
};

describe('sequence diagram matches v1', () => {
  it.each(FILE.roundTrip)('round trip: $name', async ({ code, expected }: RoundTripCase) => {
    expect(await roundTrip(EDITOR, code)).toEqual(expected);
  });

  it.each(FILE.ops)('ops: $name', async (golden: OpCase) => {
    expect(await runSteps(EDITOR, golden)).toEqual(golden.steps.map((step) => step.expected));
  });

  it.each(FILE.layouts)('layout: $name', async (golden: LayoutCase) => {
    const model: SequenceModel = await parseModel(EDITOR, golden.code);
    expect(normalizeLayout(computeLayout(model, measure))).toEqual(golden.expected);
  });
});
