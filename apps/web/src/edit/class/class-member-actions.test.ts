import { describe, expect, it } from 'vitest';

import {
  addAttr,
  addMethod,
  moveMember,
  removeMember,
  setMemberText,
  updateAttr,
  updateMethod,
} from './class-member-actions.ts';
import {
  groupInNamespace,
  NEW_NAMESPACE,
  renameNamespace,
  setClassNamespace,
  setNoteNamespace,
  ungroupNamespace,
  updateNamespace,
} from './class-namespace-actions.ts';
import {
  addNoteFor,
  reverseRelation,
  setNoteText,
  setRelationKind,
  updateNote,
  updateRelation,
} from './class-note-actions.ts';
import { NO_SELECTION } from './class-types.ts';
import { classContext, sampleModel } from '../../../tests/class-fixtures.ts';

describe('member actions', () => {
  it('adds attributes, enum values and methods', () => {
    const context = classContext();
    addAttr(context, 'Dog', false);
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Added attribute to Dog');
    addAttr(context, 'Dog', true);
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Added value to Dog');
    addMethod(context, 'Dog');
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Added method to Dog');
    expect(context.model().classes[1]).toMatchObject({
      attrs: [
        { vis: '+', text: 'String field', cls: '' },
        { vis: '', text: 'VALUE', cls: '' },
      ],
      methods: [{ name: 'method' }],
    });
  });

  it('edits, reorders, removes and retypes members', () => {
    const context = classContext();
    updateAttr(context, { classId: 'Animal', index: 0, patch: { cls: '$' } });
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Edited attribute of Animal',
    );
    updateMethod(context, { classId: 'Animal', index: 0, patch: { ret: 'String' } });
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Edited method of Animal');
    addAttr(context, 'Animal', false);
    moveMember(context, { classId: 'Animal', list: 'attrs', index: 1, delta: -1 });
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Reordered attributes of Animal',
    );
    expect(context.model().classes[0]?.attrs[1]?.cls).toBe('$');
    removeMember(context, { classId: 'Animal', list: 'methods', index: 0 });
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Removed method from Animal',
    );
    setMemberText(context, {
      classId: 'Animal',
      list: 'attrs',
      index: 0,
      text: '-run(int speed) bool',
    });
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Edited attribute of Animal',
    );
    expect(context.model().classes[0]?.methods[0]).toMatchObject({
      vis: '-',
      name: 'run',
      ret: 'bool',
    });
  });
});

describe('relation and note actions', () => {
  it('patches, retypes and reverses a relation', () => {
    const context = classContext();
    updateRelation(context, 'R:Dog:Bone:0', { label: 'buries' });
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Labelled relation Dog → Chew toy',
    );
    setRelationKind(context, 'R:Dog:Bone:0', 'dependency');
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Made Dog → Chew toy dependency',
    );
    setRelationKind(context, 'R:Dog:Bone:0', 'mystery');
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Made Dog → Chew toy mystery',
    );
    reverseRelation(context, 'R:Dog:Bone:0');
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Reversed relation Dog → Chew toy',
    );
    expect(context.model().relations[1]).toMatchObject({
      from: 'Bone',
      to: 'Dog',
      m1: '*',
      m2: '1',
    });
  });

  it('adds a note for a class, edits its text and detaches it', () => {
    const context = classContext();
    addNoteFor(context, 'Animal');
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Added note on Animal');
    setNoteText(context, 'note:Animal:0', 'Line one\nSay "hi"');
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Edited note');
    expect(context.model().notes.at(-1)?.text).toBe('Line one\\nSay #quot;hi#quot;');
    updateNote(context, 'note:Animal:0', { for: '' });
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Detached note');
    expect(context.selections.at(-1)).toEqual({ ...NO_SELECTION, nodes: ['note:-:0'] });
    updateNote(context, 'note:-:0', { ns: 'Zoo' });
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Edited note');
    updateNote(classContext(null), 'note:-:0', { ns: 'Zoo' });
  });
});

describe('namespace actions', () => {
  it('moves a class into an existing namespace under its frame, or out of it', () => {
    const context = classContext();
    setClassNamespace(context, 'Bone', 'Zoo');
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Moved Chew toy into Zoo');
    expect(context.stored().Bone!.y).toBeGreaterThan(200);
    setClassNamespace(context, 'Bone', '');
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Moved Chew toy out of its namespace',
    );
    setClassNamespace(context, 'Bone', NEW_NAMESPACE);
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Moved Chew toy into Namespace1',
    );
    setClassNamespace(classContext(null), 'Bone', 'Zoo');
  });

  it('moves a note between namespaces', () => {
    const context = classContext();
    setNoteNamespace(context, 'note:Dog:0', NEW_NAMESPACE);
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Moved note into Namespace1',
    );
    setNoteNamespace(context, 'note:Dog:0', '');
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Moved note out of its namespace',
    );
  });

  it('groups classes and notes, renames, relabels and ungroups a namespace', () => {
    const context = classContext();
    groupInNamespace(context, ['Animal', 'note:Dog:0', 'R:Dog:Bone:0']);
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Grouped 2 items in a namespace',
    );
    expect(context.selections.at(-1)).toEqual({ ...NO_SELECTION, group: 'Namespace1' });
    renameNamespace(context, 'Namespace1', 'Wild life');
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Renamed namespace Namespace1 → Wild life',
    );
    expect(context.selections.at(-1)).toEqual({ ...NO_SELECTION, group: 'Wild_life' });
    renameNamespace(context, 'Wild_life', 'Zoo');
    updateNamespace(context, 'Zoo', { label: 'The zoo' });
    expect(context.model().namespaces[0]?.label).toBe('The zoo');
    ungroupNamespace(context, 'Wild_life');
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Ungrouped namespace Wild_life',
    );
    groupInNamespace(context, ['R:Dog:Bone:0']);
    groupInNamespace(classContext(null), ['Dog']);
    expect(context.commits).toHaveBeenCalledTimes(4);
  });

  it('renames a nested namespace and declares an implicit one before patching it', () => {
    const context = classContext({
      ...sampleModel(),
      namespaces: [],
      classes: sampleModel().classes.map((item) => ({ ...item, ns: 'Outer.Inner' })),
    });
    updateNamespace(context, 'Outer', { label: 'Out' });
    expect(context.model().namespaces).toEqual([{ id: 'Outer', label: 'Out' }]);
    renameNamespace(context, 'Outer.Inner', 'Core');
    expect(context.selections.at(-1)).toEqual({ ...NO_SELECTION, group: 'Outer.Core' });
    renameNamespace(classContext(null), 'Outer', 'X');
  });
});
