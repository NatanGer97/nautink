import { describe, expect, it } from 'vitest';

import { addItem, DUPLICATE_OFFSET } from './class-actions.ts';
import {
  canConnect,
  connect,
  deleteSelection,
  duplicateClasses,
  renameClassId,
  renameFromCanvas,
  setDirection,
  setStereotype,
  updateClass,
} from './class-item-actions.ts';
import { NO_SELECTION } from './class-types.ts';
import { classContext, sampleModel } from '../../../tests/class-fixtures.ts';

const AT = { x: 600, y: 600 };

describe('addItem', () => {
  it('adds a class kind with its stereotype, selected for renaming', () => {
    const context = classContext();
    addItem(context, {
      kind: 'interface',
      at: AT,
      selection: NO_SELECTION,
      relationKind: 'association',
    });
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Added interface Interface1',
    );
    expect(context.model().classes.at(-1)).toMatchObject({
      id: 'Interface1',
      annotations: ['interface'],
    });
    expect(context.stored().Interface1).toBeDefined();
    expect(context.selections.at(-1)).toEqual({ ...NO_SELECTION, nodes: ['Interface1'] });
    expect(context.editings.at(-1)).toEqual({ id: 'Interface1', part: 'name' });
  });

  it('puts a new class in the selected namespace', () => {
    const context = classContext();
    addItem(context, {
      kind: 'class',
      at: AT,
      selection: { ...NO_SELECTION, group: 'Zoo' },
      relationKind: 'association',
    });
    expect(context.model().classes.at(-1)).toMatchObject({ id: 'Class1', ns: 'Zoo' });
  });

  it('links a class made by a dropped link with the toolbar kind, in its source namespace', () => {
    const context = classContext();
    addItem(context, {
      kind: 'class',
      at: AT,
      selection: NO_SELECTION,
      relationKind: 'composition',
      connectFrom: 'Dog',
    });
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Added class Class1 linked to Dog',
    );
    expect(context.model().relations.at(-1)).toMatchObject({
      from: 'Dog',
      to: 'Class1',
      t1: 'comp',
    });
    expect(context.model().classes.at(-1)?.ns).toBe('Zoo');
    expect(context.stored().Class1).toEqual({ x: 540, y: 574.5 });
  });

  it('adds a note on the one selected class, else a free note', () => {
    const context = classContext();
    addItem(context, {
      kind: 'note',
      at: AT,
      selection: { ...NO_SELECTION, nodes: ['Bone'] },
      relationKind: 'association',
    });
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Added note on Chew toy');
    expect(context.model().notes.at(-1)).toMatchObject({ id: 'note:Bone:0', for: 'Bone' });
    expect(context.stored()['note:Bone:0']!.x).toBeGreaterThan(300);
    expect(context.editings.at(-1)).toEqual({ id: 'note:Bone:0', part: 'note' });
    addItem(context, {
      kind: 'note',
      at: AT,
      selection: { ...NO_SELECTION, group: 'Zoo' },
      relationKind: 'association',
    });
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Added note');
    expect(context.model().notes.at(-1)).toMatchObject({ for: '', ns: 'Zoo' });
  });

  it('does nothing without a model or for an unknown kind', () => {
    const context = classContext(null);
    addItem(context, {
      kind: 'class',
      at: AT,
      selection: NO_SELECTION,
      relationKind: 'association',
    });
    const other = classContext();
    addItem(other, {
      kind: 'bogus' as 'class',
      at: AT,
      selection: NO_SELECTION,
      relationKind: 'association',
    });
    expect(context.commits).not.toHaveBeenCalled();
    expect(other.commits).not.toHaveBeenCalled();
  });
});

describe('class edits', () => {
  it('renames a class id everywhere, moving its spot and selecting it', () => {
    const context = classContext();
    renameClassId(context, 'Dog', ' Puppy ');
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Renamed Dog → Puppy');
    expect(context.model().relations[0]?.to).toBe('Puppy');
    expect(context.stored().Puppy).toEqual({ x: 0, y: 200 });
    expect(context.stored().Dog).toBeUndefined();
    renameClassId(context, 'Puppy', 'Animal');
    expect(context.commits).toHaveBeenCalledTimes(1);
  });

  it('renames in place: the display label when there is one, else the id', () => {
    const context = classContext();
    renameFromCanvas(context, 'Bone', 'Ball');
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Renamed Chew toy → Ball');
    renameFromCanvas(context, 'Bone', 'Ball');
    renameFromCanvas(context, 'Bone', '  ');
    renameFromCanvas(context, 'Missing', 'X');
    expect(context.commits).toHaveBeenCalledTimes(1);
    renameFromCanvas(context, 'Dog', 'Hound');
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Renamed Dog → Hound');
  });

  it('patches a class and sets or clears its stereotype', () => {
    const context = classContext();
    updateClass(context, 'Dog', { generic: 'T' });
    expect(context.model().classes[1]?.generic).toBe('T');
    setStereotype(context, 'Dog', 'service');
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Made Dog service');
    setStereotype(context, 'Dog', '');
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Cleared stereotype of Dog',
    );
  });
});

describe('connect', () => {
  it('allows class to class and note to class only', () => {
    const model = sampleModel();
    expect(canConnect(model, 'Animal', 'Bone')).toBe(true);
    expect(canConnect(model, 'note:Dog:0', 'Bone')).toBe(true);
    expect(canConnect(model, 'Bone', 'note:Dog:0')).toBe(true);
    expect(canConnect(model, 'note:Dog:0', 'note:Dog:0')).toBe(false);
    expect(canConnect(null, 'Animal', 'Bone')).toBe(false);
  });

  it('links two classes with a kind and selects the relation', () => {
    const context = classContext();
    connect(context, { source: 'Bone', target: 'Animal', kindId: 'inheritance' });
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Connected Chew toy → Animal',
    );
    expect(context.model().relations.at(-1)).toMatchObject({ id: 'R:Bone:Animal:0', t2: 'ext' });
    expect(context.selections.at(-1)).toEqual({ ...NO_SELECTION, edges: ['R:Bone:Animal:0'] });
  });

  it('attaches a note to a class from either end, and ignores anything else', () => {
    const context = classContext();
    connect(context, { source: 'Bone', target: 'note:Dog:0', kindId: 'association' });
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Attached note to Chew toy',
    );
    expect(context.model().notes[0]).toMatchObject({ id: 'note:Bone:0', for: 'Bone' });
    expect(context.stored()['note:Bone:0']).toEqual({ x: 200, y: 300 });
    connect(context, { source: 'note:Bone:0', target: 'Animal', kindId: 'association' });
    expect(context.model().notes[0]?.for).toBe('Animal');
    connect(context, { source: 'note:Animal:0', target: 'note:Animal:0', kindId: 'association' });
    expect(context.commits).toHaveBeenCalledTimes(2);
  });
});

describe('deleteSelection', () => {
  it('deletes classes with their relations, listing only what was picked', () => {
    const context = classContext();
    deleteSelection(context, { nodes: ['Dog'], edges: ['R:Animal:Dog:0'], group: null });
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Deleted Dog');
    expect(context.model().relations).toEqual([]);
    expect(context.model().notes).toEqual([]);
    expect(context.selections.at(-1)).toEqual(NO_SELECTION);
  });

  it('deletes notes, relations, namespaces (from a frame or the group) and lollipops', () => {
    const context = classContext();
    deleteSelection(context, {
      nodes: ['note:Dog:0', 'ns:Zoo'],
      edges: ['R:Dog:Bone:0'],
      group: 'Zoo',
    });
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Deleted 3 items');
    expect(context.model().namespaces).toEqual([]);
    expect(context.model().classes[1]?.ns).toBe('');
    const lolli = classContext({
      ...sampleModel(),
      relations: [{ ...sampleModel().relations[0]!, id: 'R:I:Dog:0', from: 'I', t1: 'lolli' }],
    });
    deleteSelection(lolli, { ...NO_SELECTION, nodes: ['lolli:R:I:Dog:0'] });
    expect(lolli.commits).toHaveBeenLastCalledWith(expect.anything(), 'Deleted relation I → Dog');
  });

  it('does nothing for an empty selection or without a model', () => {
    const context = classContext();
    deleteSelection(context, NO_SELECTION);
    deleteSelection(classContext(null), { ...NO_SELECTION, nodes: ['Dog'] });
    expect(context.commits).not.toHaveBeenCalled();
  });
});

describe('duplicateClasses', () => {
  it('copies classes next to the originals and selects the copies', () => {
    const context = classContext();
    duplicateClasses(context, ['Dog', 'note:Dog:0']);
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Duplicated Dog');
    expect(context.stored().Dog1).toEqual({ x: DUPLICATE_OFFSET, y: 200 + DUPLICATE_OFFSET });
    expect(context.selections.at(-1)).toEqual({ ...NO_SELECTION, nodes: ['Dog1'] });
    duplicateClasses(context, ['Animal', 'Bone']);
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Duplicated 2 classes');
    duplicateClasses(context, ['note:Dog:0']);
    duplicateClasses(classContext(null), ['Dog']);
    expect(context.commits).toHaveBeenCalledTimes(2);
  });

  it('places a copy of a class with no spot at the offset from the origin', () => {
    const context = classContext();
    context.positions.replace({});
    duplicateClasses(context, ['Bone']);
    expect(context.stored().Bone1).toEqual({ x: DUPLICATE_OFFSET, y: DUPLICATE_OFFSET });
  });
});

describe('setDirection', () => {
  it('changes the direction, lays out again and asks for a fit', () => {
    const context = classContext();
    setDirection(context, 'LR');
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Changed direction to LR');
    expect(context.model()).toMatchObject({ direction: 'LR', isDirExplicit: true });
    expect(context.requestFit).toHaveBeenCalled();
    setDirection(context, 'LR');
    setDirection(classContext(null), 'LR');
    expect(context.commits).toHaveBeenCalledTimes(1);
  });
});
