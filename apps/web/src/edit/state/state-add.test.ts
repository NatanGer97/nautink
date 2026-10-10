import { describe, expect, it } from 'vitest';

import {
  addComposite,
  addItem,
  addNoteOn,
  addPseudo,
  addRegion,
  addState,
  addStateInside,
  nearestState,
  toolbarSpot,
} from './state-add.ts';
import { stateGeometry } from './state-geometry.ts';
import { NO_SELECTION } from './state-types.ts';
import { sampleModel, stateContext } from '../../../tests/state-fixtures.ts';

const FAR = { x: 900, y: 900 };

describe('adding to the state canvas', () => {
  it('adds a plain state in free space, selects it and opens it for renaming', () => {
    const context = stateContext();
    addState(context, { type: 'state', at: FAR, scope: null });
    expect(context.model().states.at(-1)).toMatchObject({ id: 'State1', parent: null });
    expect(context.commits.mock.lastCall?.[1]).toBe('Added state State1');
    expect(context.selections.at(-1)).toEqual({ ...NO_SELECTION, nodes: ['State1'] });
    expect(context.editing).toHaveBeenLastCalledWith('State1');
    expect(context.stored().State1).toBeDefined();
  });

  it('adds a choice linked from a dropped transition, where it was dropped', () => {
    const context = stateContext();
    addState(context, { type: 'choice', at: { x: 100, y: 600 }, scope: null, connectFrom: 'Busy' });
    expect(context.model().transitions.at(-1)).toMatchObject({ from: 'Busy', to: 'Choice1' });
    expect(context.commits.mock.lastCall?.[1]).toBe('Added choice Choice1 after Busy');
    expect(context.stored().Choice1).toEqual({ x: 83, y: 583 });
    expect(context.editing).not.toHaveBeenCalled();
    addState(context, { type: 'state', at: FAR, scope: null, connectFrom: 'end:Box' });
    expect(context.model().transitions).toHaveLength(4);
  });

  it('adds a loose [*] once per scope, off the code', () => {
    const context = stateContext();
    addPseudo(context, 'start', { at: FAR, scope: 'Box' });
    expect(context.shown.at(-1)?.pseudo).toEqual(['start:Box']);
    expect(context.commits).not.toHaveBeenCalled();
    addPseudo(context, 'start', { at: FAR, scope: null });
    expect(context.shown).toHaveLength(1);
    expect(context.selections.at(-1)).toEqual({ ...NO_SELECTION, nodes: ['start:'] });
  });

  it('adds a composite with one state inside and opens its title', () => {
    const context = stateContext();
    addComposite(context, { at: FAR, scope: null });
    expect(context.model().states.slice(-2)).toMatchObject([
      { id: 'Composite1', isComposite: true },
      { id: 'State1', parent: 'Composite1' },
    ]);
    expect(context.selections.at(-1)).toEqual({ ...NO_SELECTION, group: 'Composite1' });
    expect(context.editing).toHaveBeenLastCalledWith('Composite1');
  });

  it('adds a note beside a state, and none on a missing state', () => {
    const context = stateContext();
    addNoteOn(context, 'Nowhere');
    expect(context.commits).not.toHaveBeenCalled();
    addNoteOn(context, 'Busy');
    expect(context.model().notes.at(-1)).toMatchObject({ id: 'note:Busy:0', side: 'right' });
    expect(context.commits.mock.lastCall?.[1]).toBe('Added note on Busy');
    expect(context.editing).toHaveBeenLastCalledWith('note:Busy:0');
  });

  it('finds the nearest state to a point', () => {
    const model = sampleModel();
    const context = stateContext();
    const geometry = stateGeometry(model, context.stored());
    expect(nearestState(model, geometry, { x: 0, y: 260 })).toBe('Busy');
    expect(nearestState({ ...model, states: [] }, geometry, { x: 0, y: 0 })).toBeNull();
  });

  it('adds toolbar items by kind; a clicked note goes on the selection, a dropped one on the nearest state', () => {
    const context = stateContext();
    const spot = { at: { x: 0, y: 260 }, scope: null };
    addItem(context, {
      kind: 'end',
      spot: { at: FAR, scope: 'Box' },
      selection: NO_SELECTION,
      isDropped: false,
    });
    expect(context.shown.at(-1)?.pseudo).toEqual(['end:Box']);
    addItem(context, {
      kind: 'note',
      spot,
      selection: { ...NO_SELECTION, nodes: ['Idle'] },
      isDropped: false,
    });
    expect(context.model().notes.at(-1)?.target).toBe('Idle');
    addItem(context, {
      kind: 'note',
      spot,
      selection: { ...NO_SELECTION, nodes: ['Idle'] },
      isDropped: true,
    });
    expect(context.model().notes.at(-1)?.target).toBe('Busy');
    addItem(context, {
      kind: 'note',
      spot,
      selection: { ...NO_SELECTION, group: 'Box' },
      isDropped: false,
    });
    expect(context.model().notes.at(-1)?.target).toBe('Box');
    addItem(context, {
      kind: 'composite',
      spot: { at: FAR, scope: null },
      selection: NO_SELECTION,
      isDropped: false,
    });
    addItem(context, {
      kind: 'fork',
      spot: { at: FAR, scope: null },
      selection: NO_SELECTION,
      isDropped: false,
    });
    expect(context.model().states.map((state) => state.id)).toContain('Fork1');
  });

  it('adds inside the selected composite (its first region), else at the given middle', () => {
    const context = stateContext();
    expect(toolbarSpot(context, NO_SELECTION, FAR)).toEqual({ at: FAR, scope: null });
    expect(toolbarSpot(context, { ...NO_SELECTION, group: 'Box' }, FAR).scope).toBe('Box');
    addRegion(context, 'Box');
    expect(toolbarSpot(context, { ...NO_SELECTION, group: 'Box' }, FAR).scope).toBe('Box#0');
  });

  it('adds a state inside a scope, and a concurrent region with its own state', () => {
    const context = stateContext();
    addStateInside(context, 'Box');
    expect(context.model().states.at(-1)).toMatchObject({ id: 'State1', parent: 'Box' });
    addPseudo(context, 'start', { at: FAR, scope: 'Box' });
    addRegion(context, 'Box');
    expect(context.model().states.find((state) => state.id === 'Box')?.regions).toBe(2);
    expect(context.model().states.at(-1)).toMatchObject({ id: 'State2', parent: 'Box#1' });
    expect(context.stored()['start:Box#0']).toEqual(context.stored()['start:Box']);
    expect(context.commits.mock.lastCall?.[1]).toBe('Added region to Box');
    addRegion(context, 'Nowhere');
    expect(context.commits).toHaveBeenCalledTimes(2);
  });

  it('does nothing before there is a model', () => {
    const context = { ...stateContext(), getModel: (): null => null };
    const spot = { at: FAR, scope: null };
    addItem(context, { kind: 'state', spot, selection: NO_SELECTION, isDropped: false });
    addState(context, { type: 'state', ...spot });
    addPseudo(context, 'start', spot);
    addComposite(context, spot);
    addNoteOn(context, 'Idle');
    addStateInside(context, 'Box');
    addRegion(context, 'Box');
    expect(toolbarSpot(context, { ...NO_SELECTION, group: 'Box' }, FAR)).toEqual({
      at: FAR,
      scope: null,
    });
    expect(context.commits).not.toHaveBeenCalled();
  });
});
