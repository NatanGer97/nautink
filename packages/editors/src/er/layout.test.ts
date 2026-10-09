import { overlaps } from '@nautink/visual-core/geometry';
import { approximateTextWidth } from '@nautink/visual-core/text-measure';
import { describe, expect, it } from 'vitest';

import {
  dagreLayout,
  firstLayout,
  freeSpot,
  gridLayout,
  placeEntities,
  placeNear,
} from './layout.ts';
import { emptyModel, parse } from './model.ts';
import { addEntity } from './ops.ts';
import { entityLayout } from './size.ts';
import { ER_FIXTURES } from '../../tests/fixtures/er.ts';
import { parseOk } from '../../tests/parse-ok.ts';

import type { ErModel } from './model.ts';
import type { PositionMap } from '@nautink/visual-core/positions';

const measure = (text: string): number => approximateTextWidth(text);
const read = async (code: string): Promise<ErModel> => parseOk(parse, code);

function expectNoOverlaps(model: ErModel, positions: PositionMap): void {
  const rects = model.entities.map((entity) => {
    const { width, height } = entityLayout(entity, measure);
    return { ...positions[entity.name]!, w: width, h: height };
  });
  rects.forEach((a, i) => {
    rects.slice(i + 1).forEach((b) => {
      expect(overlaps(a, b, 0)).toBe(false);
    });
  });
}

describe('dagreLayout', () => {
  it.each(['template', 'cardinalities', 'entities', 'subgraphs'])(
    'places every entity of %s without overlaps',
    async (name) => {
      const model = await read(ER_FIXTURES[name]!);
      const positions = dagreLayout(model, measure);
      expect(Object.keys(positions).sort()).toEqual(
        model.entities.map((entity) => entity.name).sort(),
      );
      expectNoOverlaps(model, positions);
    },
  );
});

describe('fallbacks', () => {
  it('tries the next layout when one throws, then the grid', () => {
    const model = addEntity(emptyModel(), { name: 'A' });
    const fails = (): PositionMap => {
      throw new Error('dagre failed');
    };
    expect(firstLayout(model, [fails, (): PositionMap => ({ A: { x: 5, y: 5 } })])).toEqual({
      A: { x: 5, y: 5 },
    });
    expect(firstLayout(model, [fails])).toEqual({ A: { x: 0, y: 0 } });
  });

  it('lays out a grid of four columns', () => {
    const model = ['A', 'B', 'C', 'D', 'E'].reduce(
      (next, name) => addEntity(next, { name }),
      emptyModel(),
    );
    expect(gridLayout(model)).toEqual({
      A: { x: 0, y: 0 },
      B: { x: 320, y: 0 },
      C: { x: 640, y: 0 },
      D: { x: 960, y: 0 },
      E: { x: 0, y: 260 },
    });
  });
});

describe('placeNear', () => {
  const pair = (direction: ErModel['direction']): ErModel =>
    addEntity(addEntity({ ...emptyModel(), direction }, { name: 'A' }), { name: 'B' });

  it.each([
    ['TB', { x: 0, y: 128 }],
    ['BT', { x: 0, y: -128 }],
    ['LR', { x: 280, y: 0 }],
    ['RL', { x: -280, y: 0 }],
  ] as const)('puts an entity next to its anchor in %s', (direction, spot) => {
    const model = pair(direction);
    expect(
      placeNear({
        model,
        measure,
        positions: { A: { x: 0, y: 0 } },
        entity: model.entities[1]!,
        anchorName: 'A',
      }),
    ).toEqual(spot);
  });

  it('puts an unlinked entity to the right of everything, or at the origin, and nudges it free', () => {
    const model = addEntity(pair('TB'), { name: 'C' });
    const entity = model.entities[2]!;
    expect(
      placeNear({ model, measure, positions: { A: { x: 0, y: 0 } }, entity, anchorName: null }),
    ).toEqual({ x: 240, y: 0 });
    expect(placeNear({ model, measure, positions: {}, entity, anchorName: 'A' })).toEqual({
      x: 0,
      y: 0,
    });
    const crowded = { A: { x: 0, y: 0 }, B: { x: 0, y: 128 } };
    expect(placeNear({ model, measure, positions: crowded, entity, anchorName: 'A' })).toEqual({
      x: 180,
      y: 128,
    });
    const row = { A: { x: 0, y: 0 }, B: { x: 280, y: 0 } };
    expect(
      placeNear({
        model: { ...model, direction: 'LR' },
        measure,
        positions: row,
        entity,
        anchorName: 'A',
      }),
    ).toEqual({
      x: 280,
      y: 68,
    });
  });
});

describe('freeSpot', () => {
  it('finds the nearest free spot', () => {
    const model = addEntity(emptyModel(), { name: 'A' });
    const size = { width: 150, height: 38 };
    expect(freeSpot({ model, measure, positions: {}, size, start: { x: 1, y: 1 } })).toEqual({
      x: 1,
      y: 1,
    });
    expect(
      freeSpot({ model, measure, positions: { A: { x: 0, y: 0 } }, size, start: { x: 0, y: 0 } }),
    ).toEqual({ x: -90, y: -90 });
  });
});

describe('placeEntities', () => {
  it('lays everything out when most entities are unknown', async () => {
    const result = placeEntities(await read(ER_FIXTURES.template!), {}, measure);
    expect(result.isFullLayout).toBe(true);
    expect(Object.keys(result.positions)).toHaveLength(4);
  });

  it('keeps known entities, drops stale ones and anchors new ones', async () => {
    const model = await read(
      'erDiagram\n    A ||--o{ B : x\n    C ||--o{ A : y\n    D ||--|| D : self\n    E\n',
    );
    const known = {
      A: { x: 0, y: 0 },
      B: { x: 0, y: 300 },
      D: { x: 600, y: 0 },
      stale: { x: 1, y: 1 },
    };
    const result = placeEntities(model, known, measure);
    expect(result.isFullLayout).toBe(false);
    expect(result.positions.stale).toBeUndefined();
    expect(result.positions.C).toEqual({ x: 0, y: 128 });
    expect(result.positions.E).toEqual({ x: 840, y: 0 });
  });

  it('anchors on an incoming link first', async () => {
    const model = await read('erDiagram\n    A ||--o{ B : x\n    B ||--o{ C : y\n');
    const result = placeEntities(model, { A: { x: 0, y: 0 }, C: { x: 500, y: 500 } }, measure);
    expect(result.positions.B).toEqual({ x: 0, y: 128 });
  });

  it('handles an empty model', () => {
    expect(placeEntities(emptyModel(), {}, measure)).toEqual({
      positions: {},
      isFullLayout: false,
    });
  });
});
