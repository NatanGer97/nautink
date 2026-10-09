import { describe, expect, it } from 'vitest';

import { emptyModel, parse, serialize } from './model.ts';
import {
  addNote,
  addPseudo,
  addRegion,
  addState,
  addTransition,
  checkTransition,
  deleteItems,
  normalize,
  renameState,
  reverseTransition,
  setParent,
  subtree,
  ungroup,
  updateNote,
  updateState,
  updateTransition,
  wrapInComposite,
} from './ops.ts';
import { STATE_FIXTURES } from '../../tests/fixtures/state.ts';
import { parseOk } from '../../tests/parse-ok.ts';

import type { StateModel } from './types.ts';

const read = async (code: string): Promise<StateModel> => parseOk(parse, code);
const parents = (model: StateModel): Record<string, string | null> =>
  Object.fromEntries(model.states.map((state) => [state.id, state.parent]));
const ends = (model: StateModel): string[][] =>
  model.transitions.map((transition) => [transition.from, transition.to]);

describe('states', () => {
  it('adds a state to a scope with defaults, and patches it', () => {
    const model = addState(emptyModel(), { id: 'A', name: 'Alpha' }, 'X');
    expect(model.states).toEqual([
      {
        id: 'A',
        type: 'state',
        isComposite: false,
        regions: 0,
        name: 'Alpha',
        desc: [],
        parent: 'X',
        classes: [],
        dir: '',
      },
    ]);
    expect(addState(emptyModel(), { id: 'B' }).states[0]!.parent).toBeNull();
    expect(updateState(model, 'A', { type: 'choice' }).states[0]!.type).toBe('choice');
  });

  it('renames a state everywhere, regions and pseudo states included', async () => {
    const model = await read(
      `${STATE_FIXTURES.regions!}    note right of Active : n\n    style Active fill:#f00\n`,
    );
    const renamed = renameState(addPseudo(model, 'end:Active#1'), 'Active', 'Busy');
    expect(renamed.states[0]!.id).toBe('Busy');
    expect(renamed.states[1]!.parent).toBe('Busy#0');
    expect(ends(renamed)[1]).toEqual(['start:Busy#0', 'NumLockOff']);
    expect(renamed.pseudo).toEqual(['end:Busy#1']);
    expect(renamed.notes[0]).toMatchObject({ id: 'note:Busy:0', target: 'Busy' });
    expect(renamed.styles).toEqual([{ ids: ['Busy'], css: 'fill:#f00' }]);
    expect(renameState(model, 'Active', 'Active')).toBe(model);
    expect(renameState(model, 'Active', 'NumLockOn')).toBe(model);
  });

  it('renames a plain composite scope', async () => {
    const renamed = renameState(await read(STATE_FIXTURES.template!), 'Published', 'Live2');
    expect(parents(renamed).Live).toBe('Live2');
    expect(ends(renamed)).toContainEqual(['start:Live2', 'Live']);
  });
});

describe('setParent', () => {
  it('moves a state and lets its [*] transitions follow', async () => {
    const model = await read(STATE_FIXTURES.template!);
    const moved = setParent(model, 'Live', null);
    expect(parents(moved).Live).toBeNull();
    expect(ends(moved)).toContainEqual(['start:', 'Live']);
    const inside = setParent(await read(STATE_FIXTURES.nested!), 'Deep', null);
    expect(ends(inside)).toContainEqual(['Deep', 'end:']);
  });

  it('refuses moves into itself, to the same scope and of unknown states', async () => {
    const model = await read(STATE_FIXTURES.nested!);
    expect(setParent(model, 'Outer', 'Inner')).toBe(model);
    expect(setParent(model, 'Inner', 'Outer')).toBe(model);
    expect(setParent(model, 'ghost', null)).toBe(model);
  });
});

describe('subtree and deleteItems', () => {
  it('collects a composite and everything inside it', async () => {
    const model = await read(STATE_FIXTURES.nested!);
    expect([...subtree(model, 'Outer')].sort()).toEqual(['Deep', 'Done', 'Inner', 'Outer']);
    expect([...subtree(await read(STATE_FIXTURES.regions!), 'Active')]).toHaveLength(5);
  });

  it('deletes a composite with its content and the transitions touching it', async () => {
    const model = await read(STATE_FIXTURES.nested!);
    const next = deleteItems(model, { stateIds: ['Inner'] });
    expect(next.states.map((state) => state.id)).toEqual(['Outer', 'Done']);
    expect(ends(next)).toEqual([
      ['start:', 'Outer'],
      ['Outer', 'end:'],
    ]);
  });

  it('deletes transitions, notes and pseudo states', async () => {
    const model = await read(STATE_FIXTURES.notes!);
    expect(deleteItems(model, { transitionIds: ['t0'] }).transitions).toEqual([]);
    expect(deleteItems(model, { noteIds: ['note:State1:0'] }).notes.map((note) => note.id)).toEqual(
      ['note:State2:0'],
    );
    const template = await read(STATE_FIXTURES.template!);
    expect(deleteItems(template, { pseudoIds: ['start:'] }).transitions).toHaveLength(6);
    expect(deleteItems(template, {})).toEqual(normalize(template));
  });
});

describe('transitions', () => {
  it('adds transitions with free ids and consumes loose pseudo states', () => {
    const model = addPseudo(addState(emptyModel(), { id: 'A' }), 'start:');
    const next = addTransition(
      { ...model, transitions: [{ id: 't0', from: 'A', to: 'A', label: '' }] },
      { from: 'start:', to: 'A' },
    );
    expect(next.transitions.at(-1)).toEqual({ id: 't1', from: 'start:', to: 'A', label: '' });
    expect(next.pseudo).toEqual([]);
    const crowded = { ...model, transitions: [{ id: 't1', from: 'A', to: 'A', label: '' }] };
    expect(addTransition(crowded, { from: 'A', to: 'A', label: 'x' }).transitions.at(-1)!.id).toBe(
      't2',
    );
  });

  it('patches and reverses transitions, swapping start and end', async () => {
    const model = await read(STATE_FIXTURES.template!);
    expect(updateTransition(model, 't1', { label: 'go' }).transitions[1]!.label).toBe('go');
    expect(reverseTransition(model, 't0').transitions[0]).toMatchObject({
      from: 'Draft',
      to: 'end:',
    });
    expect(reverseTransition(model, 't1').transitions[1]).toMatchObject({
      from: 'Review',
      to: 'Draft',
    });
    expect(() => reverseTransition(model, 'nope')).toThrow('No transition "nope"');
  });

  it('adds a loose pseudo state only once and only when unused', async () => {
    const model = await read(STATE_FIXTURES.template!);
    expect(addPseudo(model, 'start:')).toBe(model);
    const added = addPseudo(model, 'end:Published');
    expect(added.pseudo).toEqual(['end:Published']);
    expect(addPseudo(added, 'end:Published')).toBe(added);
  });

  it('checks which transitions are allowed', async () => {
    const model = await read(STATE_FIXTURES.template!);
    expect(checkTransition(model, 'Draft', 'Live')).toEqual({ from: 'Draft', to: 'Live' });
    expect(checkTransition(model, 'end:', 'Draft')).toEqual({ from: 'Draft', to: 'end:' });
    expect(checkTransition(model, 'start:Published', 'Draft')).toBeNull();
    expect(checkTransition(model, 'start:', 'end:')).toEqual({ from: 'start:', to: 'end:' });
    expect(checkTransition(model, 'start:', 'end:Published')).toBeNull();
    expect(checkTransition(model, 'Live', 'end:Published')).toEqual({
      from: 'Live',
      to: 'end:Published',
    });
  });
});

describe('composites', () => {
  it('wraps states in a composite inside their common scope', async () => {
    const model = await read(STATE_FIXTURES.template!);
    const { model: wrapped, id } = wrapInComposite(model, ['Live', 'Archived']);
    expect(id).toBe('Composite1');
    expect(parents(wrapped)).toMatchObject({
      Composite1: 'Published',
      Live: 'Composite1',
      Archived: 'Composite1',
    });
    expect(ends(wrapped)).toContainEqual(['start:Published', 'Live']);
    const nested = wrapInComposite(model, ['Published', 'Live', 'Draft']);
    expect(parents(nested.model)).toMatchObject({
      Published: 'Composite1',
      Draft: 'Composite1',
      Live: 'Published',
    });
    expect(wrapInComposite(model, ['ghost'])).toEqual({ model, id: null });
  });

  it('ungroups a composite into its scope, dropping its own transitions', async () => {
    const model = await read(`${STATE_FIXTURES.template!}    note right of Published : n\n`);
    const next = ungroup(model, 'Published');
    expect(parents(next)).toMatchObject({ Live: null, Archived: null });
    expect(ends(next)).toEqual([
      ['start:', 'Draft'],
      ['Draft', 'Review'],
      ['Review', 'Draft'],
      ['Live', 'Archived'],
    ]);
    expect(next.notes).toEqual([]);
    const regions = ungroup(
      addPseudo(await read(STATE_FIXTURES.regions!), 'end:Active#1'),
      'Active',
    );
    expect(regions.pseudo).toEqual([]);
    expect(ungroup(model, 'ghost')).toBe(model);
  });

  it('adds concurrent regions', async () => {
    const model = await read(STATE_FIXTURES.template!);
    const split = addRegion(addPseudo(model, 'end:Published'), 'Published', 'Other');
    expect(split.states.find((state) => state.id === 'Published')!.regions).toBe(2);
    expect(parents(split)).toMatchObject({ Live: 'Published#0', Other: 'Published#1' });
    expect(ends(split)).toContainEqual(['start:Published#0', 'Live']);
    expect(split.pseudo).toEqual(['end:Published#0']);
    const third = addRegion(split, 'Published', 'Third');
    expect(parents(third).Third).toBe('Published#2');
    expect(addRegion(model, 'Draft', 'X')).toBe(model);
    expect(addRegion(model, 'ghost', 'X')).toBe(model);
  });

  it('compacts regions that become empty', async () => {
    const model = await read(STATE_FIXTURES.regions!);
    const one = deleteItems(model, { stateIds: ['CapsLockOff', 'CapsLockOn'] });
    expect(one.states[0]!.regions).toBe(0);
    expect(parents(one)).toMatchObject({ NumLockOff: 'Active', NumLockOn: 'Active' });
    expect(serialize(one)).not.toContain('--\n');
    const three = addRegion(model, 'Active', 'Extra');
    const middle = deleteItems(three, { stateIds: ['CapsLockOff', 'CapsLockOn'] });
    expect(middle.states[0]!.regions).toBe(2);
    expect(parents(middle).Extra).toBe('Active#1');
  });
});

describe('normalize regions', () => {
  it('keeps full regions and regions holding only a loose pseudo state', async () => {
    const model = await read(STATE_FIXTURES.regions!);
    expect(normalize(model)).toEqual(model);
    const split = addRegion(model, 'Active', 'Extra');
    const loose = addPseudo(deleteItems(split, { stateIds: ['Extra'] }), 'start:Active#2');
    expect(
      normalize({
        ...loose,
        states: loose.states.map((state) =>
          state.id === 'Active' ? { ...state, regions: 3 } : state,
        ),
      }).states[0]!.regions,
    ).toBe(3);
    expect(deleteItems(addPseudo(model, 'end:'), { stateIds: ['NumLockOn'] }).pseudo).toEqual([
      'end:',
    ]);
  });
});

describe('notes', () => {
  it('adds and patches notes', () => {
    const model = addNote(addState(emptyModel(), { id: 'A' }), { target: 'A' });
    expect(model.notes).toEqual([{ id: 'note:A:0', target: 'A', side: 'right', text: 'Note' }]);
    expect(addNote(model, { target: 'A', side: 'left', text: 'x' }).notes[1]).toEqual({
      id: 'note:A:1',
      target: 'A',
      side: 'left',
      text: 'x',
    });
    expect(updateNote(model, 'note:A:0', { text: 'y' }).notes[0]!.text).toBe('y');
  });
});

describe('normalize', () => {
  it('drops dangling references and moves orphans to the top level', () => {
    const model: StateModel = {
      ...addState(addState(emptyModel(), { id: 'A' }, 'Gone'), { id: 'B' }),
      transitions: [
        { id: 't0', from: 'A', to: 'ghost', label: '' },
        { id: 't1', from: 'start:Gone', to: 'A', label: '' },
        { id: 't2', from: 'A', to: 'B', label: '' },
      ],
      notes: [{ id: '', target: 'ghost', side: 'left', text: '' }],
      pseudo: ['end:Gone', 'end:', 'start:'],
      styles: [
        { ids: ['ghost'], css: 'x' },
        { ids: ['A', 'ghost'], css: 'y' },
      ],
    };
    const next = normalize({
      ...model,
      transitions: [...model.transitions, { id: 't3', from: 'start:', to: 'B', label: '' }],
    });
    expect(parents(next)).toEqual({ A: null, B: null });
    expect(next.transitions.map((transition) => transition.id)).toEqual(['t2', 't3']);
    expect(next.notes).toEqual([]);
    expect(next.pseudo).toEqual(['end:']);
    expect(next.styles).toEqual([{ ids: ['A'], css: 'y' }]);
  });
});
