// Locks the class diagram port to v1's exact output: round trips, edit ops and layout positions.
import { describe, expect, it } from 'vitest';

import { dagreLayout, placeItems } from './layout.ts';
import { parse, serialize } from './model.ts';
import * as classOps from './ops.ts';
import golden from '../../tests/golden/class.json' with { type: 'json' };
import {
  copyPositions,
  measure,
  parseModel,
  roundTrip,
  rounded,
  runSteps,
} from '../../tests/golden-runner.ts';

import type { ClassModel } from './types.ts';
import type {
  GoldenEditor,
  GoldenFile,
  LayoutCase,
  OpCase,
  Placed,
  RoundTripCase,
} from '../../tests/golden-runner.ts';
import type { Placement } from '../shared/positions.ts';

const FILE: GoldenFile = golden;
const EDITOR: GoldenEditor<ClassModel> = { parse, serialize, ops: [classOps] };

async function layOut(golden: LayoutCase): Promise<Placed> {
  const model: ClassModel = await parseModel(EDITOR, golden.code);
  if (golden.kind === 'dagre') {
    return { positions: rounded(dagreLayout(model, measure)) };
  }
  const placed: Placement = placeItems(model, copyPositions(golden.start), measure);
  return { isFullLayout: placed.isFullLayout, positions: rounded(placed.positions) };
}

describe('class diagram matches v1', () => {
  it.each(FILE.roundTrip)('round trip: $name', async ({ code, expected }: RoundTripCase) => {
    expect(await roundTrip(EDITOR, code)).toEqual(expected);
  });

  it.each(FILE.ops)('ops: $name', async (golden: OpCase) => {
    expect(await runSteps(EDITOR, golden)).toEqual(golden.steps.map((step) => step.expected));
  });

  it.each(FILE.layouts)('layout: $name', async (golden: LayoutCase) => {
    expect(await layOut(golden)).toEqual(golden.expected);
  });
});
