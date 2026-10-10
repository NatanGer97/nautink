import { describe, expect, it } from 'vitest';

import { CanvasPress } from './canvas-press.ts';
import { dragOutcome, dragPreview, insideMoving } from './sequence-drag.ts';
import {
  dropOutcome,
  NOTE_DRAG_DATA,
  blockDragData,
  participantDragData,
} from './sequence-drop.ts';
import { itemSelection, NO_SELECTION, participantSelection } from './sequence-types.ts';
import { layoutOf, sampleModel } from '../../../tests/sequence-fixtures.ts';

import type { DragScene, DragSession, DragStart } from './sequence-drag.ts';
import type { SequenceModel } from '@nautink/editors/sequence/types';

async function scene(overrides: Partial<DragScene> = {}): Promise<DragScene> {
  const model: SequenceModel = await sampleModel();
  return {
    model,
    layout: layoutOf(model),
    selection: NO_SELECTION,
    isReadOnly: false,
    ...overrides,
  };
}

function session(start: DragStart, isMoved: boolean, origin = { x: 0, y: 0 }): DragSession {
  return { start, origin, client: { x: 0, y: 0 }, isMoved };
}

function colX(drag: DragScene, id: string): number {
  return drag.layout.cols.find((col) => col.id === id)?.x ?? 0;
}

describe('CanvasPress', () => {
  it('turns into a drag past the threshold, and ends once', () => {
    const press = new CanvasPress();
    expect(press.move({ x: 9, y: 9 })).toBeNull();
    press.start({ mode: 'col', id: 'A' }, { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(press.move({ x: 2, y: 2 })).toBeNull();
    expect(press.move({ x: 10, y: 0 })?.isMoved).toBe(true);
    expect(press.move({ x: 11, y: 0 })?.isMoved).toBe(true);
    expect(press.end()?.start).toEqual({ mode: 'col', id: 'A' });
    expect(press.end()).toBeNull();
  });
});

describe('drag previews', () => {
  it('shows a column, a link and a slot', async () => {
    const drag = await scene();
    const b: number = colX(drag, 'B');
    expect(dragPreview(session({ mode: 'col', id: 'A' }, true), { x: 30, y: 0 }, drag)).toEqual({
      mode: 'col',
      id: 'A',
      dx: 30,
      x: 30,
    });
    expect(
      dragPreview(
        session({ mode: 'link', from: 'A', x: 1 }, true, { x: 1, y: 200 }),
        { x: b, y: 210 },
        drag,
      ),
    ).toMatchObject({ mode: 'link', target: 'B', y0: 200 });
    expect(
      dragPreview(
        session({ mode: 'item', id: 'i0', ids: ['i0'], isShift: false }, true),
        { x: 0, y: 9999 },
        drag,
      ),
    ).toMatchObject({ mode: 'item', slot: { key: 'root', index: 3 } });
    expect(
      dragPreview(session({ mode: 'pan', view: { x: 0, y: 0, k: 1 } }, true), { x: 0, y: 0 }, drag),
    ).toBeNull();
  });

  it('never drops a block into itself', async () => {
    const drag = await scene();
    const isInside = insideMoving(drag.model, ['i1']);
    expect(isInside({ key: 'i1:0', index: 0, y: 0, depth: 1 })).toBe(true);
    expect(isInside({ key: 'root', index: 0, y: 0, depth: 0 })).toBe(false);
  });
});

describe('drag outcomes', () => {
  it('selects on a click', async () => {
    const drag = await scene();
    expect(dragOutcome(session({ mode: 'col', id: 'A' }, false), { x: 0, y: 0 }, drag)).toEqual({
      kind: 'select',
      selection: participantSelection('A'),
    });
    expect(
      dragOutcome(session({ mode: 'link', from: 'B', x: 0 }, false), { x: 0, y: 0 }, drag),
    ).toEqual({ kind: 'select', selection: participantSelection('B') });
    expect(
      dragOutcome(
        session({ mode: 'item', id: 'i0', ids: ['i0'], isShift: false }, false),
        { x: 0, y: 0 },
        drag,
      ),
    ).toEqual({ kind: 'select', selection: itemSelection(['i0'], 'i0') });
    expect(
      dragOutcome(
        session({ mode: 'pan', view: { x: 0, y: 0, k: 1 } }, false),
        { x: 0, y: 0 },
        drag,
      ),
    ).toEqual({ kind: 'clear' });
    expect(
      dragOutcome(session({ mode: 'pan', view: { x: 0, y: 0, k: 1 } }, true), { x: 0, y: 0 }, drag),
    ).toEqual({ kind: 'none' });
  });

  it('extends a row selection with Shift', async () => {
    const drag = await scene({ selection: itemSelection(['i0'], 'i0') });
    expect(
      dragOutcome(
        session({ mode: 'item', id: 'i4', ids: ['i4'], isShift: true }, false),
        { x: 0, y: 0 },
        drag,
      ),
    ).toEqual({ kind: 'select', selection: itemSelection(['i0', 'i1', 'i4'], 'i0') });
  });

  it('reorders columns past their neighbours', async () => {
    const drag = await scene();
    const right: number = colX(drag, 'B') + 10;
    expect(dragOutcome(session({ mode: 'col', id: 'A' }, true), { x: right, y: 0 }, drag)).toEqual({
      kind: 'moveParticipant',
      id: 'A',
      to: 2,
    });
    expect(dragOutcome(session({ mode: 'col', id: 'B' }, true), { x: -100, y: 0 }, drag)).toEqual({
      kind: 'moveParticipant',
      id: 'B',
      to: 0,
    });
    expect(dragOutcome(session({ mode: 'col', id: 'A' }, true), { x: -100, y: 0 }, drag)).toEqual({
      kind: 'select',
      selection: participantSelection('A'),
    });
  });

  it('adds a message between lifelines, or to the same one', async () => {
    const drag = await scene();
    const a: number = colX(drag, 'A');
    const b: number = colX(drag, 'B');
    const link = session({ mode: 'link', from: 'A', x: a }, true, { x: a, y: 9999 });
    expect(dragOutcome(link, { x: b, y: 9999 }, drag)).toEqual({
      kind: 'addMessage',
      from: 'A',
      to: 'B',
      slot: { key: 'root', index: 3 },
    });
    expect(dragOutcome(link, { x: a + 1, y: 10050 }, drag)).toMatchObject({
      kind: 'addMessage',
      to: 'A',
    });
    expect(dragOutcome(link, { x: a + 1, y: 9999 }, drag)).toEqual({ kind: 'none' });
    expect(dragOutcome(link, { x: b + 500, y: 9999 }, drag)).toEqual({ kind: 'none' });
    expect(dragOutcome(link, { x: b, y: 9999 }, await scene({ isReadOnly: true }))).toEqual({
      kind: 'none',
    });
  });

  it('moves rows to the nearest slot, unless read-only', async () => {
    const drag = await scene();
    const start: DragStart = { mode: 'item', id: 'i0', ids: ['i0'], isShift: false };
    expect(dragOutcome(session(start, true), { x: 0, y: 9999 }, drag)).toEqual({
      kind: 'moveRows',
      ids: ['i0'],
      slot: { key: 'root', index: 3 },
    });
    expect(
      dragOutcome(session(start, true), { x: 0, y: 9999 }, await scene({ isReadOnly: true })),
    ).toEqual({ kind: 'select', selection: itemSelection(['i0']) });
  });
});

describe('drops', () => {
  it('adds participants, notes and blocks where they are let go', async () => {
    const { layout } = await scene();
    const b: number = layout.cols.find((col) => col.id === 'B')?.x ?? 0;
    expect(dropOutcome(participantDragData('actor'), { x: b - 1, y: 0 }, layout)).toEqual({
      kind: 'participant',
      participantKind: 'actor',
      index: 1,
    });
    expect(dropOutcome(NOTE_DRAG_DATA, { x: b - 5, y: 9999 }, layout)).toEqual({
      kind: 'note',
      actor: 'B',
      placement: 'left',
      slot: { key: 'root', index: 3 },
    });
    expect(dropOutcome(blockDragData('loop'), { x: 0, y: 9999 }, layout)).toEqual({
      kind: 'block',
      blockKind: 'loop',
      slot: { key: 'root', index: 3 },
    });
    expect(dropOutcome('participant:robot', { x: 0, y: 0 }, layout)).toBeNull();
    expect(dropOutcome('text/plain', { x: 0, y: 0 }, layout)).toBeNull();
  });
});
