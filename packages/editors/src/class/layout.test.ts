import { overlaps } from '@nautink/visual-core/geometry';
import { approximateTextWidth } from '@nautink/visual-core/text-measure';
import { describe, expect, it } from 'vitest';

import {
  allNamespaces,
  canvasItems,
  dagreLayout,
  freeSpot,
  lolliId,
  placeItems,
  placeNear,
  relationEnds,
  tagItems,
} from './layout.ts';
import { emptyModel, parse } from './model.ts';
import { addClass } from './ops.ts';
import { CLASS_FIXTURES } from '../../tests/fixtures/class.ts';
import { parseOk } from '../../tests/parse-ok.ts';

import type { CanvasItem } from './layout.ts';
import type { ClassModel } from './types.ts';
import type { PositionMap } from '@nautink/visual-core/positions';

const measure = (text: string): number => approximateTextWidth(text);
const read = async (code: string): Promise<ClassModel> => parseOk(parse, code);

function expectNoOverlaps(items: readonly CanvasItem[], positions: PositionMap): void {
  const rects = items.map((item) => ({
    ...positions[item.id]!,
    w: item.size.width,
    h: item.size.height,
  }));
  rects.forEach((a, i) => {
    rects.slice(i + 1).forEach((b) => {
      expect(overlaps(a, b, 0)).toBe(false);
    });
  });
}

describe('canvas items', () => {
  it('lists classes, notes and lollipops with their ends', async () => {
    const model = await read(`${CLASS_FIXTURES.lollipops!}    note for Foo "n"\n`);
    expect(canvasItems(model, measure).map((item) => [item.kind, item.id])).toEqual([
      ['class', 'Foo'],
      ['class', 'Baz'],
      ['note', 'note:Foo:0'],
      ['lolli', 'lolli:R:Bar:Foo:0'],
      ['lolli', 'lolli:R:Baz:Qux:0'],
    ]);
    expect(relationEnds(model.relations[0]!)).toEqual([lolliId(model.relations[0]!), 'Foo']);
    expect(relationEnds(model.relations[1]!)).toEqual(['Baz', lolliId(model.relations[1]!)]);
  });

  it('lists every namespace, implicit parents included', async () => {
    const model = await read(`${CLASS_FIXTURES.namespaces!}    note "x"\n`);
    expect(allNamespaces({ ...model, notes: [{ ...model.notes[0]!, ns: 'A.B' }] })).toEqual([
      'Shapes',
      'Outer',
      'Outer.Inner',
      'A.B',
      'A',
    ]);
  });
});

describe('dagreLayout', () => {
  it.each(['template', 'namespaces', 'notes', 'lollipops', 'relations'])(
    'places every item of %s without overlaps',
    async (name) => {
      const model = await read(CLASS_FIXTURES[name]!);
      const items = canvasItems(model, measure);
      const positions = dagreLayout(model, measure);
      expect(Object.keys(positions).sort()).toEqual(items.map((item) => item.id).sort());
      expectNoOverlaps(items, positions);
    },
  );

  it('puts the general class above the specific one', async () => {
    const positions = dagreLayout(await read('classDiagram\n    Animal <|-- Dog\n'), measure);
    expect(positions.Dog!.y).toBeGreaterThan(positions.Animal!.y);
    const reversed = dagreLayout(await read('classDiagram\n    Dog --|> Animal\n'), measure);
    expect(reversed.Dog!.y).toBeGreaterThan(reversed.Animal!.y);
  });
});

describe('placeNear', () => {
  const twoClasses = (direction: ClassModel['direction']): ClassModel =>
    addClass(addClass({ ...emptyModel(), direction }, { id: 'A' }), { id: 'B' });

  it.each([
    ['TB', { x: 0, y: 131 }],
    ['BT', { x: 0, y: -131 }],
    ['LR', { x: 220, y: 0 }],
    ['RL', { x: -220, y: 0 }],
  ] as const)('puts an item next to its anchor in %s', (direction, spot) => {
    const model = twoClasses(direction);
    const item = canvasItems(model, measure)[1]!;
    expect(
      placeNear({ model, positions: { A: { x: 0, y: 0 } }, item, anchorId: 'A', measure }),
    ).toEqual(spot);
  });

  it('puts an unlinked item to the right of everything, or at the origin, and nudges it free', () => {
    const model = addClass(twoClasses('TB'), { id: 'C' });
    const item = canvasItems(model, measure)[2]!;
    expect(
      placeNear({ model, positions: { A: { x: 0, y: 0 } }, item, anchorId: null, measure }),
    ).toEqual({ x: 200, y: 0 });
    expect(placeNear({ model, positions: {}, item, anchorId: 'A', measure })).toEqual({
      x: 0,
      y: 0,
    });
    const crowded = { A: { x: 0, y: 0 }, B: { x: 0, y: 131 } };
    expect(placeNear({ model, positions: crowded, item, anchorId: 'A', measure })).toEqual({
      x: 160,
      y: 131,
    });
    const sideways = { ...model, direction: 'LR' as const };
    const row = { A: { x: 0, y: 0 }, B: { x: 220, y: 0 } };
    expect(placeNear({ model: sideways, positions: row, item, anchorId: 'A', measure })).toEqual({
      x: 220,
      y: 80,
    });
  });
});

describe('freeSpot', () => {
  it('finds the nearest free spot', () => {
    const model = addClass(emptyModel(), { id: 'A' });
    const size = { width: 100, height: 50 };
    expect(freeSpot({ model, positions: {}, size, start: { x: 0, y: 0 }, measure })).toEqual({
      x: 0,
      y: 0,
    });
    expect(
      freeSpot({ model, positions: { A: { x: 0, y: 0 } }, size, start: { x: 0, y: 0 }, measure }),
    ).toEqual({
      x: -120,
      y: -120,
    });
  });
});

describe('placeItems', () => {
  it('lays everything out when most items are unknown', async () => {
    const model = await read(CLASS_FIXTURES.notes!);
    const result = placeItems(model, {}, measure);
    expect(result.isFullLayout).toBe(true);
    expect(result.positions['note:A:0']!.l).toBe('Line one\\nLine two');
  });

  it('keeps known items, drops stale ones and anchors new ones', async () => {
    const model = await read(
      `${CLASS_FIXTURES.lollipops!}    Foo --> Qux\n    Qux --> New\n    note for Foo "n"\n    note "free"\n    class Lonely\n    Newer --> Foo\n`,
    );
    const known = {
      Foo: { x: 0, y: 0 },
      Qux: { x: 300, y: 0 },
      Baz: { x: 900, y: 900 },
      'lolli:R:Bar:Foo:0': { x: 0, y: -100 },
      'lolli:R:Baz:Qux:0': { x: 300, y: -100 },
      'note:-:0': { x: 600, y: 0, l: 'old text' },
      stale: { x: 1, y: 1 },
    };
    const result = placeItems(model, known, measure);
    expect(result.isFullLayout).toBe(false);
    expect(result.positions.stale).toBeUndefined();
    expect(result.positions.Lonely).toBeDefined();
    expect(result.positions.Newer).toBeDefined();
    expect(result.positions.Foo).toEqual({ x: 0, y: 0 });
    expect(result.positions.New).toEqual({ x: 300, y: 131 });
    expect(result.positions['note:Foo:0']).toEqual({ x: 175, y: 131, l: 'n' });
    expect(result.positions['note:-:0']).toMatchObject({ l: 'free' });
  });

  it('anchors a new lollipop on its class', async () => {
    const model = await read('classDiagram\n    A --> B\n    I ()-- A\n    B --() J\n');
    const result = placeItems(model, { A: { x: 0, y: 0 }, B: { x: 0, y: 300 } }, measure);
    expect(result.positions['lolli:R:I:A:0']).toEqual({ x: 49, y: 131 });
    expect(result.positions['lolli:R:B:J:0']).toEqual({ x: 49, y: 431 });
  });

  it('handles an empty model', () => {
    expect(placeItems(emptyModel(), {}, measure)).toEqual({ positions: {}, isFullLayout: false });
  });
});

describe('tagItems', () => {
  it('records note text next to note positions only', async () => {
    const model = await read(CLASS_FIXTURES.notes!);
    expect(tagItems(model, { A: { x: 0, y: 0 }, 'note:-:0': { x: 1, y: 1 } })).toEqual({
      A: { x: 0, y: 0 },
      'note:-:0': { x: 1, y: 1, l: 'A free note' },
    });
  });
});
