import { overlaps } from '@nautink/visual-core/geometry';
import { describe, expect, it } from 'vitest';

import {
  computeBoxes,
  dagreLayout,
  frames,
  freeSpot,
  isHorizontalBar,
  leaves,
  placeNodes,
  placeNote,
  placeNotes,
  tagLabels,
} from './layout.ts';
import { emptyModel, parse } from './model.ts';
import { addPseudo, addState } from './ops.ts';
import { nodeSize } from './size.ts';
import { STATE_FIXTURES } from '../../tests/fixtures/state.ts';
import { parseOk } from '../../tests/parse-ok.ts';

import type { StateModel } from './types.ts';
import type { PositionMap } from '@nautink/visual-core/positions';

const read = async (code: string): Promise<StateModel> => parseOk(parse, code);

function expectNoOverlaps(model: StateModel, positions: PositionMap): void {
  const rects = leaves(model).list.map((leaf) => {
    const size = nodeSize(leaf.data);
    return { ...positions[leaf.id]!, w: size.width, h: size.height };
  });
  rects.forEach((a, i) => {
    rects.slice(i + 1).forEach((b) => {
      expect(overlaps(a, b, 0)).toBe(false);
    });
  });
}

describe('leaves and frames', () => {
  it('lists states, pseudo states, empty composites and notes', async () => {
    const model = addState(addPseudo(await read(STATE_FIXTURES.template!), 'end:Published'), {
      id: 'Box',
      isComposite: true,
    });
    expect(leaves(model).list.map((leaf) => [leaf.id, leaf.data.kind, leaf.scope])).toEqual([
      ['Draft', 'state', null],
      ['Review', 'state', null],
      ['Live', 'state', 'Published'],
      ['Archived', 'state', 'Published'],
      ['Box', 'emptyComposite', null],
      ['start:', 'start', null],
      ['start:Published', 'start', 'Published'],
      ['end:', 'end', null],
      ['end:Published', 'end', 'Published'],
    ]);
  });

  it('draws fork bars flat in top-down layouts', async () => {
    const model = await read(STATE_FIXTURES.pseudoStates!);
    expect(isHorizontalBar(model)).toBe(true);
    expect(leaves({ ...model, direction: 'LR' }).list[0]!.data).toEqual({
      kind: 'fork',
      isHorizontal: false,
      title: 'fork fork_state',
    });
    expect(isHorizontalBar({ ...model, direction: 'BT' })).toBe(true);
  });

  it('lists frames deepest first, regions included', async () => {
    const model = await read(STATE_FIXTURES.regions!);
    const { isNonEmpty } = leaves(model);
    expect(frames(model, isNonEmpty)).toEqual([
      { id: 'Active#0', kind: 'region', parent: 'Active', depth: 2, owner: 'Active', index: 0 },
      { id: 'Active#1', kind: 'region', parent: 'Active', depth: 2, owner: 'Active', index: 1 },
      { id: 'Active', kind: 'composite', parent: null, depth: 1, regions: 2 },
    ]);
  });
});

describe('dagreLayout', () => {
  it.each(Object.keys(STATE_FIXTURES))('places every leaf of %s without overlaps', async (name) => {
    const model = await read(STATE_FIXTURES[name]!);
    const positions = dagreLayout(model);
    expect(Object.keys(positions).sort()).toEqual(
      leaves(model)
        .list.map((leaf) => leaf.id)
        .sort(),
    );
    expectNoOverlaps(model, positions);
  });

  it('lays regions side by side in a row or a column', async () => {
    const row = dagreLayout(await read(STATE_FIXTURES.regions!));
    expect(row.CapsLockOff!.x).toBeGreaterThan(row.NumLockOff!.x);
    const column = dagreLayout({ ...(await read(STATE_FIXTURES.regions!)), direction: 'LR' });
    expect(column.CapsLockOff!.y).toBeGreaterThan(column.NumLockOff!.y);
  });

  it('frames composites around their content', async () => {
    const model = await read(STATE_FIXTURES.regions!);
    const { list, isNonEmpty } = leaves(model);
    const boxes = computeBoxes({
      leaves: list,
      frames: frames(model, isNonEmpty),
      positions: dagreLayout(model),
    });
    expect(boxes.Active!.x).toBeLessThan(boxes['Active#0']!.x);
    expect(boxes.Active!.y + boxes.Active!.h).toBeGreaterThan(
      boxes['Active#1']!.y + boxes['Active#1']!.h,
    );
    expect(
      computeBoxes({ leaves: list, frames: frames(model, isNonEmpty), positions: {} }),
    ).toEqual({});
  });
});

describe('notes', () => {
  it('stacks notes beside their target', async () => {
    const model = await read(`${STATE_FIXTURES.notes!}    note right of State1 : second\n`);
    const positions = dagreLayout(model);
    const box = {
      x: positions.State1!.x,
      w: nodeSize({ kind: 'state', label: 'State1', desc: [] }).width,
    };
    expect(positions['note:State1:0']!.x).toBeGreaterThan(box.x);
    expect(positions['note:State1:1']!.y).toBeGreaterThan(positions['note:State1:0']!.y);
    expect(positions['note:State2:0']!.x).toBeLessThan(positions.State2!.x);
  });

  it('moves only the notes asked for', async () => {
    const model = await read(STATE_FIXTURES.notes!);
    const positions = {
      State1: { x: 0, y: 0 },
      State2: { x: 0, y: 300 },
      'note:State2:0': { x: 9, y: 9 },
    };
    const placed = placeNote(model, positions, 'note:State1:0');
    expect(placed['note:State2:0']).toEqual({ x: 9, y: 9 });
    expect(placed['note:State1:0']).toBeDefined();
    expect(placeNotes(model, { State2: { x: 0, y: 0 } })['note:State1:0']).toBeUndefined();
  });
});

describe('freeSpot', () => {
  it('finds a free spot, ignoring some leaves and avoiding extra boxes', () => {
    const model = addState(emptyModel(), { id: 'A' });
    const size = { width: 50, height: 50 };
    const positions = { A: { x: 0, y: 0 } };
    expect(freeSpot({ model, positions, size, start: { x: 0, y: 0 } })).toEqual({ x: -72, y: -72 });
    expect(freeSpot({ model, positions, size, start: { x: 0, y: 0 }, ignore: ['A'] })).toEqual({
      x: 0,
      y: 0,
    });
    expect(
      freeSpot({
        model,
        positions: {},
        size,
        start: { x: 0, y: 0 },
        extra: [{ x: 0, y: 0, w: 10, h: 10 }],
      }),
    ).toEqual({ x: -24, y: 24 });
  });
});

describe('placeNodes', () => {
  it('lays everything out when most leaves are unknown', async () => {
    const result = placeNodes(await read(STATE_FIXTURES.template!), {});
    expect(result.isFullLayout).toBe(true);
    expect(result.positions.Draft!.l).toBe('Draft');
    expect(result.positions['start:']!.l).toBe('start');
  });

  it('places new leaves next to a link, else beside their siblings', async () => {
    const model = await read(
      'stateDiagram-v2\n    [*] --> A\n    A --> B\n    C --> A\n    note left of A : n\n',
    );
    const known = {
      'start:': { x: 0, y: 0, l: 'start' },
      A: { x: 0, y: 100, l: 'A' },
      stale: { x: 1, y: 1 },
    };
    const result = placeNodes(model, known);
    expect(result.isFullLayout).toBe(false);
    expect(result.positions.stale).toBeUndefined();
    expect(result.positions.B).toEqual({ x: 0, y: 200, l: 'B' });
    expect(result.positions.C).toEqual({ x: 48, y: -48, l: 'C' });
    expect(result.positions['note:A:0']).toMatchObject({ l: 'note:A' });
  });

  it.each([
    ['LR', { x: 156, y: 100 }],
    ['RL', { x: -156, y: 100 }],
    ['BT', { x: 0, y: 0 }],
  ] as const)('follows the %s direction', async (direction, spot) => {
    const model = { ...(await read('stateDiagram-v2\n    A --> B\n    C\n')), direction };
    const result = placeNodes(model, {
      A: { x: 0, y: 100, l: 'A' },
      C: { x: 900, y: 900, l: 'C' },
    });
    expect(result.positions.B).toMatchObject(spot);
  });

  it('places a new leaf before its link target and with no placed leaves at the origin', async () => {
    const model = { ...(await read('stateDiagram-v2\n    A --> B\n')), direction: 'BT' as const };
    expect(placeNodes(model, { B: { x: 0, y: 0, l: 'B' } }).positions.A).toMatchObject({
      x: 0,
      y: 100,
    });
    const lone = await read('stateDiagram-v2\n    Z\n    Y\n');
    expect(placeNodes(lone, { Z: { x: 5, y: 5, l: 'Z' } }).positions.Y).toMatchObject({
      x: 151,
      y: 5,
    });
  });

  it('handles an empty model and tags labels', () => {
    expect(placeNodes(emptyModel(), {})).toEqual({ positions: {}, isFullLayout: false });
    expect(
      tagLabels(addState(emptyModel(), { id: 'A', isComposite: true }), { A: { x: 0, y: 0 } }),
    ).toEqual({ A: { x: 0, y: 0, l: 'A' } });
  });
});
