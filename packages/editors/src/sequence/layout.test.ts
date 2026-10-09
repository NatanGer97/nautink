import { describe, expect, it } from 'vitest';

import {
  computeLayout,
  headerWidth,
  isRevHead,
  linesOf,
  nearestCol,
  nearestSlot,
} from './layout.ts';
import { emptyModel, parse } from './model.ts';
import { SEQUENCE_FIXTURES } from '../../tests/fixtures/sequence.ts';
import { parseOk } from '../../tests/parse-ok.ts';

import type { SequenceModel } from './types.ts';

const measure = (text: string): number => text.length * 7;
const read = async (code: string): Promise<SequenceModel> => parseOk(parse, code);

describe('computeLayout', () => {
  it.each(Object.keys(SEQUENCE_FIXTURES))(
    'lays out %s with ordered, non-overlapping columns',
    async (name) => {
      const model = await read(SEQUENCE_FIXTURES[name]!);
      const layout = computeLayout(model, measure);
      expect(layout.cols.map((col) => col.id)).toEqual(
        model.participants.map((participant) => participant.id),
      );
      layout.cols.slice(1).forEach((col, index) => {
        const previous = layout.cols[index]!;
        expect(col.x - col.w / 2).toBeGreaterThanOrEqual(previous.x + previous.w / 2);
      });
      const rowYs = layout.rows.map((row) => row.y);
      expect(rowYs).toEqual([...rowYs].sort((a, b) => a - b));
      expect(layout.height).toBeGreaterThan(layout.end);
    },
  );

  it('gives the template its rows, blocks, bars and slots', async () => {
    const layout = computeLayout(await read(SEQUENCE_FIXTURES.template!), measure);
    expect(layout.rows).toHaveLength(8);
    expect(layout.blocks.map((block) => block.sections.length)).toEqual([2]);
    expect(layout.bars.map((bar) => [bar.actor, bar.isOpen, bar.y2 > bar.y1])).toEqual([
      ['A', false, true],
    ]);
    expect(layout.slots.filter((slot) => slot.key === 'root')).toHaveLength(7);
  });

  it('numbers messages and places created and destroyed participants', async () => {
    const numbered = computeLayout(await read(SEQUENCE_FIXTURES.autonumber!), measure);
    expect(numbered.rows.filter((row) => row.item.t === 'msg').map((row) => row.num)).toEqual([
      10,
      undefined,
      3,
      4,
    ]);
    const lifecycle = computeLayout(await read(SEQUENCE_FIXTURES.lifecycle!), measure);
    const carl = lifecycle.cols.find((col) => col.id === 'C')!;
    expect(carl.y).toBeGreaterThan(carl.top);
    expect(carl.isDestroyed).toBe(true);
    expect(carl.lifeBottom).toBeLessThan(lifecycle.end);
  });

  it('frames boxes and titles', async () => {
    const boxes = computeLayout(await read(SEQUENCE_FIXTURES.boxes!), measure);
    expect(boxes.boxes.map((frame) => frame.box.id)).toEqual(['box1', 'box2', 'box3', 'box4']);
    const titled = computeLayout(await read(SEQUENCE_FIXTURES.text!), measure);
    expect(titled.title).toBe('Login flow');
    expect(titled.top).toBe(44);
  });

  it('handles an empty diagram and empty blocks', async () => {
    const empty = computeLayout(emptyModel(), measure);
    expect(empty).toMatchObject({ title: '', titleX: 100, cols: [], rows: [], width: 40, minX: 0 });
    const blocks = computeLayout(
      await read('sequenceDiagram\n    loop empty\n    end\n    alt\n    else\n    end\n'),
      measure,
    );
    expect(blocks.blocks).toHaveLength(2);
    expect(blocks.blocks[0]!.x2 - blocks.blocks[0]!.x1).toBeGreaterThanOrEqual(160);
  });

  it('places notes on every side and self messages with activations', async () => {
    const layout = computeLayout(
      await read(
        'sequenceDiagram\n    participant A\n    participant B\n    Note left of B: a much longer note on the left of B\n    Note left of A: l\n    Note right of B: r\n    Note over A,B: both\n    A->>+A: self\n    A->>-B: back\n',
      ),
      measure,
    );
    const [, left, right, over, self] = layout.rows;
    expect(left!.nx2).toBeLessThan(layout.cols[0]!.x);
    expect(right!.nx1).toBeGreaterThan(layout.cols[1]!.x);
    expect(over!.nx1).toBeLessThan(layout.cols[0]!.x);
    expect(self!.isSelf).toBe(true);
    expect(layout.bars).toHaveLength(1);
  });
});

describe('models built by hand', () => {
  it('tolerates references to unknown participants and open activations', () => {
    const model: SequenceModel = {
      ...emptyModel(),
      participants: [{ id: 'A', label: 'A', kind: 'participant', box: null, isCreated: false }],
      boxes: [{ id: 'empty', name: '', fill: 'transparent' }],
      items: [
        {
          t: 'msg',
          id: 'm',
          from: 'A',
          to: 'ghost',
          text: 'x',
          line: 'solid',
          head: 'arrow',
          act: '-',
          central: '',
          create: [],
          destroy: [],
        },
        { t: 'note', id: 'n', placement: 'left', actors: ['ghost'], text: 'n' },
        {
          t: 'note',
          id: 'l',
          placement: 'left',
          actors: ['A'],
          text: 'a long note on the left side',
        },
        { t: 'act', id: 'a', actor: 'ghost', isOn: true },
        { t: 'act', id: 'b', actor: 'A', isOn: true },
        { t: 'note', id: 'g', placement: 'left', actors: ['ghost', 'A'], text: 'g' },
      ],
    };
    const layout = computeLayout(model, measure);
    expect(layout.rows.map((row) => row.h)).toEqual([24, 42, 42, 20, 20, 42]);
    expect(layout.rows[1]!.nx1).toBe(20);
    expect(layout.bars).toEqual([expect.objectContaining({ actor: 'A', isOpen: true })]);
    expect(layout.boxes).toEqual([]);
    expect(layout.cols[0]!.x).toBeGreaterThan(200);
  });
});

describe('helpers', () => {
  it('measures headers and splits display lines', () => {
    expect(
      headerWidth({ id: 'A', label: 'A', kind: 'actor', box: null, isCreated: false }, measure),
    ).toBe(64);
    expect(
      headerWidth({ id: 'Q', label: 'Queue', kind: 'queue', box: null, isCreated: false }, measure),
    ).toBe(92);
    expect(linesOf('a<br>b')).toEqual(['a', 'b']);
    expect(isRevHead('halfTopRev')).toBe(true);
    expect(isRevHead('arrow')).toBe(false);
  });

  it('finds the nearest slot and column', async () => {
    const layout = computeLayout(await read(SEQUENCE_FIXTURES.blocks!), measure);
    const slot = nearestSlot(layout, layout.y0)!;
    expect(slot).toMatchObject({ key: 'root', index: 0 });
    expect(nearestSlot(layout, layout.y0, (candidate) => candidate.key === 'root')!.key).not.toBe(
      'root',
    );
    expect(nearestSlot(computeLayout(emptyModel(), measure), 0, () => true)).toBeNull();
    const first = layout.cols[0]!;
    expect(nearestCol(layout, first.x + 5)!.id).toBe(first.id);
    expect(nearestCol(layout, -1000)).toBeNull();
  });
});
