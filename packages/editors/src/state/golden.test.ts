// Locks the state diagram port to v1's exact output: round trips, edit ops and layout positions.
import { describe, expect, it } from 'vitest';

import { dagreLayout, placeNodes } from './layout.ts';
import { parse, serialize } from './model.ts';
import * as stateOps from './ops.ts';
import { GOLDEN_DEVIATIONS } from '../../tests/golden/deviations.ts';
import golden from '../../tests/golden/state.json' with { type: 'json' };
import {
  applyDeviations,
  copyPositions,
  parseModel,
  roundTrip,
  rounded,
  runSteps,
} from '../../tests/golden-runner.ts';

import type { StateModel } from './types.ts';
import type {
  GoldenChange,
  GoldenDeviations,
  GoldenEditor,
  GoldenFile,
  LayoutCase,
  OpCase,
  Placed,
  RoundTripCase,
} from '../../tests/golden-runner.ts';
import type { Placement } from '../shared/positions.ts';

// v1's outputs, with the port's intentional deviations (tests/golden/deviations.ts) in their place.
const FILE: GoldenFile = applyDeviations(golden, GOLDEN_DEVIATIONS);
const EDITOR: GoldenEditor<StateModel> = { parse, serialize, ops: [stateOps] };

async function layOut(golden: LayoutCase): Promise<Placed> {
  const model: StateModel = await parseModel(EDITOR, golden.code);
  if (golden.kind === 'dagre') {
    return { positions: rounded(dagreLayout(model)) };
  }
  const placed: Placement = placeNodes(model, copyPositions(golden.start));
  return { isFullLayout: placed.isFullLayout, positions: rounded(placed.positions) };
}

describe('golden deviations', () => {
  const change = { kind: 'roundTrip', name: 'descriptions', expected: 'x' } as const;
  it('refuse a case that is gone, a missing op step, or an output equal to v1', () => {
    const deviations = (changes: GoldenChange[]): GoldenDeviations[] => [
      { editor: 'state', reason: 'test', changes },
    ];
    expect(() => applyDeviations(golden, deviations([{ ...change, name: 'gone' }]))).toThrow(
      'No roundTrip case named "gone"',
    );
    const op = golden.ops[0]!;
    expect(() =>
      applyDeviations(
        golden,
        deviations([{ kind: 'ops', name: op.name, step: 99, expected: 'x' }]),
      ),
    ).toThrow('has no step 99');
    const v1 = golden.layouts[0]!;
    expect(() =>
      applyDeviations(
        golden,
        deviations([{ kind: 'layouts', name: v1.name, expected: v1.expected }]),
      ),
    ).toThrow('matches v1');
    expect(applyDeviations(golden, [{ editor: 'flow', reason: 'test', changes: [change] }])).toBe(
      golden,
    );
  });
});

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
