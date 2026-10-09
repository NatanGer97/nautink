// Locks the state diagram port to v1's exact output: round trips, edit ops and layout positions.
import { describe, expect, it } from 'vitest';

import { dagreLayout, placeNodes } from './layout.ts';
import { parse, serialize } from './model.ts';
import * as stateOps from './ops.ts';
import golden from '../../tests/golden/state.json' with { type: 'json' };
import {
  copyPositions,
  parseModel,
  roundTrip,
  rounded,
  runSteps,
} from '../../tests/golden-runner.ts';

import type { StateModel } from './types.ts';
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
const EDITOR: GoldenEditor<StateModel> = { parse, serialize, ops: [stateOps] };

async function layOut(golden: LayoutCase): Promise<Placed> {
  const model: StateModel = await parseModel(EDITOR, golden.code);
  if (golden.kind === 'dagre') {
    return { positions: rounded(dagreLayout(model)) };
  }
  const placed: Placement = placeNodes(model, copyPositions(golden.start));
  return { isFullLayout: placed.isFullLayout, positions: rounded(placed.positions) };
}

describe('state diagram matches v1', () => {
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
