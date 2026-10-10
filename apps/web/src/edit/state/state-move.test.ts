import { describe, expect, it } from 'vitest';

import { boxOf, isInside, stateGeometry } from './state-geometry.ts';
import { draggedPositions, nudgedIds, setParent, shifted } from './state-move.ts';
import { sampleModel, samplePositions, stateContext } from '../../../tests/state-fixtures.ts';

describe('moving on the state canvas', () => {
  it('moves a state into a composite, next to its new siblings', () => {
    const context = stateContext();
    setParent(context, 'Busy', 'Box');
    expect(context.model().states.find((state) => state.id === 'Busy')?.parent).toBe('Box');
    expect(context.commits.mock.lastCall?.[1]).toBe('Moved Busy into Box');
    expect(context.stored().Busy?.x).toBeGreaterThan(300);
  });

  it('moves a state to the top level, right of everything, with its notes', () => {
    const context = stateContext();
    setParent(context, 'Inner', null);
    expect(context.commits.mock.lastCall?.[1]).toBe('Moved Inner to the top level');
    const before = samplePositions().Inner;
    expect(context.stored().Inner?.x).toBeGreaterThan(before?.x ?? 0);
    setParent(context, 'Inner', null);
    setParent(context, 'Box', 'Box');
    expect(context.commits).toHaveBeenCalledTimes(1);
  });

  it('carries a dragged frame’s content and a dragged state’s notes, unless those are dragged too', () => {
    const model = sampleModel();
    const positions = samplePositions();
    const frame = boxOf(stateGeometry(model, positions), 'Box');
    const framed = draggedPositions(model, positions, [
      { id: 'Box', position: { x: (frame?.x ?? 0) + 10, y: (frame?.y ?? 0) + 5 } },
    ]);
    expect(framed.Inner).toEqual({ x: 410, y: 105 });
    const withNote = draggedPositions(model, positions, [
      { id: 'Idle', position: { x: 20, y: 100 } },
    ]);
    expect(withNote['note:Idle:0']).toEqual({ x: 170, y: 100 });
    const both = draggedPositions(model, positions, [
      { id: 'Idle', position: { x: 20, y: 100 } },
      { id: 'note:Idle:0', position: { x: 0, y: 0 } },
    ]);
    expect(both['note:Idle:0']).toMatchObject({ x: 0, y: 0 });
    expect(
      draggedPositions(model, positions, [{ id: 'nowhere', position: { x: 1, y: 1 } }]),
    ).toEqual(positions);
  });

  it('nudges selected items with what they carry, and shifts only known spots', () => {
    const model = sampleModel();
    expect(nudgedIds(model, samplePositions(), ['Box', 'Idle']).sort()).toEqual([
      'Box',
      'Idle',
      'Inner',
      'note:Idle:0',
    ]);
    expect(shifted({ A: { x: 1, y: 1 } }, ['A', 'B'], { x: 2, y: 3 })).toEqual({
      A: { x: 3, y: 4 },
    });
  });

  it('does nothing before there is a model', () => {
    const context = { ...stateContext(), getModel: (): null => null };
    setParent(context, 'Busy', 'Box');
    expect(context.commits).not.toHaveBeenCalled();
    expect(isInside({ x: 0, y: 0 }, undefined)).toBe(false);
  });
});
