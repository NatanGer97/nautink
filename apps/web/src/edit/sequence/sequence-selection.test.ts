import { describe, expect, it, vi } from 'vitest';

import { editTargetOf, handleSequenceKey } from './sequence-keys.ts';
import { boxName, itemName, participantName } from './sequence-names.ts';
import {
  clickedRow,
  draggedRows,
  liveSelection,
  selectedItems,
  selectionOfIds,
} from './sequence-selection.ts';
import { itemSelection, NO_SELECTION, participantSelection } from './sequence-types.ts';
import {
  clampZoom,
  fitSequence,
  stageTransform,
  toCanvasPoint,
  wheelFactor,
  zoomAround,
  zoomCentered,
} from './sequence-view.ts';
import { sampleModel, testContext } from '../../../tests/sequence-fixtures.ts';

import type { SequenceModel } from '@nautink/editors/sequence/types';

const BOXED: string = [
  'sequenceDiagram',
  '    box Purple Team',
  '        participant A',
  '    end',
  '    box rgb(1, 2, 3)',
  '        participant B',
  '    end',
  '    A->>B: x',
  '    activate B',
  '    autonumber',
  '    deactivate B',
  '    rect rgb(1, 1, 1)',
  '        B->>A: y',
  '    end',
  '',
].join('\n');

function key(name: string, extra: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: name, ...extra });
}

describe('names', () => {
  it('names participants, rows and boxes', async () => {
    const model: SequenceModel = await sampleModel(BOXED);
    expect(participantName(model, 'A')).toBe('A');
    expect(participantName(model, 'Z')).toBe('Z');
    expect(itemName(model, 'i0')).toBe('message A → B');
    expect(itemName(model, 'i1')).toBe('activation of B');
    expect(itemName(model, 'i2')).toBe('autonumber');
    expect(itemName(model, 'i3')).toBe('deactivation of B');
    expect(itemName(model, 'i4')).toBe('rect block');
    expect(itemName(model, 'nope')).toBe('item');
    expect(boxName(model, 'box1')).toBe('Team');
    expect(boxName(model, 'box2')).toBe('rgb(1, 2, 3)');
    expect(boxName(model, 'nope')).toBe('nope');
  });
});

describe('selection', () => {
  it('drops what an outside change removed', async () => {
    const model: SequenceModel = await sampleModel();
    const rows = itemSelection(['i0', 'gone']);
    expect(liveSelection(rows, model)).toEqual(itemSelection(['i0']));
    expect(liveSelection(itemSelection(['i0']), model)).toEqual(itemSelection(['i0']));
    expect(liveSelection(participantSelection('Z'), model)).toEqual(NO_SELECTION);
    expect(liveSelection({ kind: 'box', ids: ['box1'] }, model)).toEqual(NO_SELECTION);
    expect(liveSelection(NO_SELECTION, model)).toEqual(NO_SELECTION);
    expect(liveSelection(rows, null)).toEqual(NO_SELECTION);
  });

  it('tells the app what is selected', async () => {
    const model: SequenceModel = await sampleModel(BOXED);
    expect(selectedItems(model, participantSelection('A'))).toEqual([
      { id: 'A', label: 'A', kind: 'participant' },
    ]);
    expect(selectedItems(model, { kind: 'box', ids: ['box1'] })).toEqual([
      { id: 'box1', label: 'Team', kind: 'box' },
    ]);
    expect(selectedItems(model, itemSelection(['i0', 'i4', 'gone']))).toEqual([
      { id: 'i0', label: 'message A → B: x', kind: 'message' },
      { id: 'i4', label: 'rect block', kind: 'block' },
      { id: 'gone', label: 'item', kind: 'item' },
    ]);
    expect(selectedItems(null, participantSelection('A'))).toEqual([]);
  });

  it('selects participants Split asks for', async () => {
    const model: SequenceModel = await sampleModel();
    expect(selectionOfIds(model, ['A', 'i0'])).toEqual(participantSelection('A'));
    expect(selectionOfIds(model, ['i0'])).toEqual(NO_SELECTION);
    expect(selectionOfIds(null, ['A'])).toEqual(NO_SELECTION);
  });

  it('clicks rows, with Shift for a range, and drags the selected neighbours', async () => {
    const model: SequenceModel = await sampleModel();
    expect(clickedRow(model, NO_SELECTION, { id: 'i0', isShift: true })).toEqual(
      itemSelection(['i0'], 'i0'),
    );
    const range = clickedRow(model, itemSelection(['i0'], 'i0'), { id: 'i4', isShift: true });
    expect(range).toEqual(itemSelection(['i0', 'i1', 'i4'], 'i0'));
    expect(draggedRows(model, range, 'i1')).toEqual(['i0', 'i1', 'i4']);
    expect(draggedRows(model, range, 'i2')).toEqual(['i2']);
    expect(draggedRows(model, itemSelection(['i0', 'i2']), 'i0')).toEqual(['i0']);
  });
});

describe('keys', () => {
  it('finds what Enter edits', async () => {
    const model: SequenceModel = await sampleModel(BOXED);
    expect(editTargetOf(model, participantSelection('A'))).toEqual({
      kind: 'participant',
      id: 'A',
    });
    expect(editTargetOf(model, itemSelection(['i0']))).toEqual({ kind: 'message', id: 'i0' });
    expect(editTargetOf(model, itemSelection(['i4']))).toBeNull();
    expect(editTargetOf(model, itemSelection(['i0', 'i1']))).toBeNull();
    expect(editTargetOf(model, { kind: 'box', ids: ['box1'] })).toBeNull();
    expect(editTargetOf(null, itemSelection(['i0']))).toBeNull();
    const notes: SequenceModel = await sampleModel();
    expect(editTargetOf(notes, itemSelection(['i3']))).toEqual({ kind: 'note', id: 'i3' });
    expect(editTargetOf(notes, itemSelection(['i1']))).toEqual({
      kind: 'section',
      id: 'i1',
      sectionIndex: 0,
    });
  });

  it('deletes, edits, steps and fits', async () => {
    const context = testContext(await sampleModel());
    const fit = vi.fn();
    const deps = { context, isReadOnly: false, fit };
    expect(handleSequenceKey(key('!', { shiftKey: true, code: 'Digit1' }), deps)).toBe(true);
    expect(fit).toHaveBeenCalled();
    context.select(itemSelection(['i4']));
    expect(handleSequenceKey(key('ArrowUp'), deps)).toBe(true);
    expect(context.commits.mock.lastCall?.[1]).toBe('Moved message Bob → Alice');
    expect(handleSequenceKey(key('Enter'), deps)).toBe(true);
    expect(context.editing()).toEqual({ kind: 'message', id: 'i4' });
    expect(handleSequenceKey(key('Escape'), deps)).toBe(false);
    expect(context.editing()).toBeNull();
    context.select(participantSelection('A'));
    expect(handleSequenceKey(key('ArrowRight'), deps)).toBe(true);
    expect(context.model().participants[1]?.id).toBe('A');
    expect(handleSequenceKey(key('ArrowUp'), deps)).toBe(false);
    expect(handleSequenceKey(key('Backspace'), deps)).toBe(true);
    expect(context.selection()).toEqual(NO_SELECTION);
    expect(handleSequenceKey(key('Delete'), deps)).toBe(false);
    expect(handleSequenceKey(key('Delete', { metaKey: true }), deps)).toBe(false);
    expect(handleSequenceKey(key('Delete'), { ...deps, isReadOnly: true })).toBe(false);
  });
});

describe('view', () => {
  it('fits the drawing above the prompt bar, no larger than 120 %', () => {
    const bounds = { minX: -20, width: 380, height: 300 };
    const fitted = fitSequence(bounds, { width: 1000, height: 800 }, 76);
    expect(fitted.k).toBe(1.2);
    expect(fitted.x).toBeCloseTo((1000 - 400 * 1.2) / 2);
    expect(fitSequence(bounds, { width: 0, height: 0 }, 0)).toEqual({ x: 0, y: 0, k: 1 });
    const small = fitSequence(
      { minX: 0, width: 4000, height: 100 },
      { width: 448, height: 400 },
      0,
    );
    expect(small.k).toBeCloseTo(0.1);
  });

  it('zooms around a point, maps screen points to the canvas, and clamps', () => {
    const view = zoomAround({ x: 0, y: 0, k: 1 }, 2, { x: 100, y: 100 });
    expect(view).toEqual({ k: 2, x: -100, y: -100 });
    expect(zoomCentered(view, 0.5, { width: 200, height: 200 })).toEqual({ k: 1, x: 0, y: 0 });
    expect(toCanvasPoint({ x: 100, y: 100 }, view, -10)).toEqual({ x: 90, y: 100 });
    expect(clampZoom(9)).toBe(3);
    expect(clampZoom(0)).toBe(0.1);
    expect(wheelFactor(-100)).toBeGreaterThan(1);
    expect(stageTransform({ x: 1, y: 2, k: 3 })).toBe('translate(1px, 2px) scale(3)');
  });
});
