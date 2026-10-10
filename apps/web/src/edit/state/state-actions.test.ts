import { describe, expect, it } from 'vitest';

import {
  canConnect,
  connect,
  deleteSelection,
  deletedNames,
  renameId,
  renameInline,
  reverseTransition,
  setDirection,
  ungroup,
  updateNote,
  updateState,
  updateTransition,
  wrap,
} from './state-actions.ts';
import { NO_SELECTION } from './state-types.ts';
import { sampleModel, stateContext } from '../../../tests/state-fixtures.ts';

describe('state actions', () => {
  it('records state and transition edits as labelled steps', () => {
    const context = stateContext();
    updateState(context, 'Idle', { name: 'Waiting' });
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Renamed Idle → Waiting');
    updateTransition(context, 't1', { label: 'start' });
    expect(context.commits.mock.lastCall?.[1]).toBe('Labelled transition Waiting → Busy');
    reverseTransition(context, 't1');
    expect(context.model().transitions[1]).toMatchObject({ from: 'Busy', to: 'Idle' });
    expect(context.commits.mock.lastCall?.[1]).toBe('Reversed transition Waiting → Busy');
  });

  it('changes direction and lays the diagram out again, once', () => {
    const context = stateContext();
    setDirection(context, 'TB');
    expect(context.commits).not.toHaveBeenCalled();
    setDirection(context, 'LR');
    expect(context.model().direction).toBe('LR');
    expect(context.commits.mock.lastCall?.[1]).toBe('Changed direction to LR');
    expect(context.requestFit).toHaveBeenCalled();
  });

  it('deletes states, notes, [*] and transitions; transitions that go with a state are not named', () => {
    const model = sampleModel();
    expect(
      deletedNames(model, { nodes: ['Idle', 'note:Idle:0'], edges: ['t1'], group: 'Box' }),
    ).toEqual(['Idle', 'note', 'Box']);
    expect(deletedNames(model, { ...NO_SELECTION, edges: ['t1'] })).toEqual([
      'transition Idle → Busy',
    ]);
    const context = stateContext();
    deleteSelection(context, NO_SELECTION);
    expect(context.commits).not.toHaveBeenCalled();
    deleteSelection(context, { nodes: ['start:'], edges: [], group: 'Box' });
    expect(context.model().states.map((state) => state.id)).toEqual(['Idle', 'Busy']);
    expect(context.model().transitions.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(context.commits.mock.lastCall?.[1]).toBe('Deleted 2 items');
    expect(context.selections.at(-1)).toEqual(NO_SELECTION);
  });

  it('connects two items (swapping ends that only work the other way) and selects the transition', () => {
    const model = sampleModel();
    expect(canConnect(model, 'Idle', 'Busy')).toBe(true);
    expect(canConnect(model, 'Idle', 'note:Idle:0')).toBe(false);
    expect(canConnect(null, 'Idle', 'Busy')).toBe(false);
    const context = stateContext();
    connect(context, 'Inner', 'start:Box');
    expect(context.model().transitions.at(-1)).toMatchObject({ from: 'start:Box', to: 'Inner' });
    expect(context.commits.mock.lastCall?.[1]).toBe('Connected start → Inner');
    expect(context.selections.at(-1)).toEqual({ ...NO_SELECTION, edges: ['t3'] });
    connect(context, 'end:', 'end:Box');
    expect(context.commits).toHaveBeenCalledTimes(1);
  });

  it('renames an id with its spots and notes, and refuses a bad or taken id', () => {
    const context = stateContext();
    expect(renameId(context, { from: 'Idle', to: 'Busy' })).toBe(false);
    expect(renameId(context, { from: 'Idle', to: '1x' })).toBe(false);
    expect(renameId(context, { from: 'Box', to: 'Frame' }, { ...NO_SELECTION, group: 'Box' })).toBe(
      true,
    );
    expect(context.selections.at(-1)).toEqual({ ...NO_SELECTION, group: 'Frame' });
    expect(renameId(context, { from: 'Idle', to: 'Ready' })).toBe(true);
    expect(context.stored()).toHaveProperty('Ready');
    expect(context.stored()).toHaveProperty(['note:Ready:0']);
    expect(context.commits.mock.lastCall?.[1]).toBe('Renamed Idle → Ready');
    expect(context.selections.at(-1)).toEqual({ ...NO_SELECTION, nodes: ['Ready'] });
  });

  it('renames inline: a new id when it can, else a display name; notes get their text', () => {
    const context = stateContext();
    renameInline(context, 'Idle', 'Idle');
    renameInline(context, 'Idle', '  ');
    expect(context.commits).not.toHaveBeenCalled();
    renameInline(context, 'Idle', 'Ready');
    expect(context.model().states[0]?.id).toBe('Ready');
    renameInline(context, 'Busy', 'Very busy');
    expect(context.model().states[1]).toMatchObject({ id: 'Busy', name: 'Very busy' });
    expect(context.commits.mock.lastCall?.[1]).toBe('Renamed Busy → Very busy');
    renameInline(context, 'note:Ready:0', 'Waits');
    expect(context.commits).toHaveBeenCalledTimes(2);
    renameInline(context, 'note:Ready:0', 'Line one\nLine two');
    expect(context.model().notes[0]?.text).toBe('Line one\nLine two');
    renameInline(context, 'Nowhere', 'x');
    expect(context.commits).toHaveBeenCalledTimes(3);
  });

  it('moves a note to the other side and deletes it when its text is cleared', () => {
    const context = stateContext();
    updateNote(context, 'note:Idle:0', { side: 'left' });
    expect(context.commits.mock.lastCall?.[1]).toBe('Moved note');
    expect(context.stored()['note:Idle:0']?.x).toBeLessThan(0);
    updateNote(context, 'note:Idle:0', { text: '' });
    expect(context.model().notes).toEqual([]);
    expect(context.commits.mock.lastCall?.[1]).toBe('Deleted note');
  });

  it('wraps states in a composite and ungroups it again', () => {
    const context = stateContext();
    wrap(context, []);
    expect(context.commits).not.toHaveBeenCalled();
    wrap(context, ['Idle', 'Busy']);
    expect(context.commits.mock.lastCall?.[1]).toBe('Wrapped 2 states in Composite1');
    expect(context.selections.at(-1)).toEqual({ ...NO_SELECTION, group: 'Composite1' });
    ungroup(context, 'Composite1');
    expect(context.model().states.find((state) => state.id === 'Composite1')).toBeUndefined();
    expect(context.commits.mock.lastCall?.[1]).toBe('Ungrouped Composite1');
  });

  it('does nothing before there is a model', () => {
    const context = { ...stateContext(), getModel: (): null => null };
    setDirection(context, 'LR');
    connect(context, 'Idle', 'Busy');
    wrap(context, ['Idle']);
    updateNote(context, 'note:Idle:0', { text: 'x' });
    renameInline(context, 'Idle', 'x');
    updateState(context, 'Idle', { name: 'x' });
    expect(renameId(context, { from: 'Idle', to: 'Ready' })).toBe(false);
    expect(context.commits).not.toHaveBeenCalled();
  });
});
