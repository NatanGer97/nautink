import { describe, expect, it } from 'vitest';

import { emptyModel, parse } from './model.ts';
import {
  addAttr,
  addClass,
  addMethod,
  addNote,
  addRelation,
  deleteItems,
  groupInNamespace,
  moveMember,
  removeMember,
  renameClass,
  renameNamespace,
  reverseRelation,
  setClassNamespace,
  setMemberText,
  setNoteNamespace,
  setRelationKind,
  setStereotype,
  ungroupNamespace,
  updateAttr,
  updateClass,
  updateMethod,
  updateNamespace,
  updateNote,
  updateRelation,
} from './ops.ts';
import { CLASS_FIXTURES } from '../../tests/fixtures/class.ts';
import { parseOk } from '../../tests/parse-ok.ts';

import type { ClassItem, ClassModel } from './types.ts';

const read = async (code: string): Promise<ClassModel> => parseOk(parse, code);
const template = async (): Promise<ClassModel> => read(CLASS_FIXTURES.template!);
const animal = (model: ClassModel): ClassItem =>
  model.classes.find((item) => item.id === 'Animal')!;

describe('classes', () => {
  it('adds a class with empty defaults and patches it', () => {
    const model = addClass(emptyModel(), { id: 'A', label: 'Alpha' });
    expect(model.classes).toEqual([
      {
        id: 'A',
        label: 'Alpha',
        generic: '',
        annotations: [],
        attrs: [],
        methods: [],
        css: [],
        ns: '',
      },
    ]);
    expect(updateClass(model, 'A', { generic: 'T' }).classes[0]!.generic).toBe('T');
  });

  it('renames a class everywhere it is referenced', async () => {
    const model = await read(
      `${CLASS_FIXTURES.styling!}    A --> B\n    note for A "n"\n    A ()-- B\n`,
    );
    const renamed = renameClass(model, 'A', ' Z ');
    expect(renamed.classes.map((item) => item.id)).toEqual(['Z', 'B']);
    expect(renamed.relations.map((relation) => [relation.from, relation.to])).toEqual([
      ['Z', 'B'],
      ['A', 'B'],
    ]);
    expect(renamed.notes[0]!.for).toBe('Z');
    expect(renamed.extra).toContain('cssClass "Z,B" cool');
    expect(renamed.extra).toContain('click Z href "https://example.com"');
    expect(renamed.extra).toContain('classDef hot fill:#f00');
  });

  it('keeps the model when the new id is empty, the same or taken', async () => {
    const model = await template();
    expect(renameClass(model, 'Dog', '')).toBe(model);
    expect(renameClass(model, 'Dog', 'Dog')).toBe(model);
    expect(renameClass(model, 'Dog', 'Cat')).toBe(model);
  });

  it('sets and clears the stereotype', async () => {
    const model = await template();
    expect(animal(setStereotype(model, 'Animal', '«service»')).annotations).toEqual(['service']);
    expect(animal(setStereotype(model, 'Animal', ' ')).annotations).toEqual([]);
  });
});

describe('members', () => {
  it('adds default members', async () => {
    const model = await template();
    expect(animal(addAttr(model, 'Animal')).attrs.at(-1)).toEqual({
      vis: '+',
      text: 'attribute',
      cls: '',
    });
    expect(animal(addMethod(model, 'Animal')).methods.at(-1)).toEqual({
      vis: '+',
      name: 'method',
      params: '',
      ret: '',
      cls: '',
    });
  });

  it('normalizes typed attribute text', async () => {
    const model = await template();
    expect(
      animal(updateAttr(model, { classId: 'Animal', index: 0, patch: { text: '-id(x)$' } }))
        .attrs[0],
    ).toEqual({
      vis: '-',
      text: 'idx',
      cls: '$',
    });
    expect(
      animal(updateAttr(model, { classId: 'Animal', index: 0, patch: { cls: '*' } })).attrs[0],
    ).toEqual({
      vis: '+',
      text: 'String name',
      cls: '*',
    });
  });

  it('cleans method fields', async () => {
    const model = await template();
    const patch = { name: ' run(x) ', params: '(a)\n{b}', ret: 'int$' };
    expect(animal(updateMethod(model, { classId: 'Animal', index: 0, patch })).methods[0]).toEqual({
      vis: '+',
      name: 'runx',
      params: 'a  b ',
      ret: 'int',
      cls: '*',
    });
  });

  it('throws on a member index that does not exist', async () => {
    const model = await template();
    expect(() => updateAttr(model, { classId: 'Animal', index: 9, patch: {} })).toThrow(
      'Class "Animal" has no member at index 9',
    );
  });

  it('replaces, moves or removes a member from typed text', async () => {
    const model = await template();
    const ref = { classId: 'Animal', index: 0 };
    expect(animal(setMemberText(model, { ...ref, list: 'attrs', text: '#age' })).attrs[0]).toEqual({
      vis: '#',
      text: 'age',
      cls: '',
    });
    const moved = animal(setMemberText(model, { ...ref, list: 'attrs', text: 'speak() void' }));
    expect(moved.attrs).toHaveLength(1);
    expect(moved.methods.at(-1)).toEqual({
      vis: '',
      name: 'speak',
      params: '',
      ret: 'void',
      cls: '',
    });
    expect(
      animal(setMemberText(model, { ...ref, list: 'methods', text: '+eat(food) bool' })).methods[0]!
        .name,
    ).toBe('eat');
    const toAttr = animal(setMemberText(model, { ...ref, list: 'methods', text: 'weight' }));
    expect([toAttr.methods.length, toAttr.attrs.at(-1)!.text]).toEqual([0, 'weight']);
    expect(animal(setMemberText(model, { ...ref, list: 'attrs', text: '  ' })).attrs).toHaveLength(
      1,
    );
    expect(setMemberText(model, { ...ref, list: 'attrs', text: ')' })).toBe(model);
  });

  it('removes and moves members', async () => {
    const model = await template();
    expect(
      animal(removeMember(model, { classId: 'Animal', list: 'attrs', index: 0 })).attrs,
    ).toHaveLength(1);
    expect(
      animal(moveMember(model, { classId: 'Animal', list: 'attrs', index: 0, delta: 1 })).attrs[0]!
        .text,
    ).toBe('int age');
    expect(
      animal(moveMember(model, { classId: 'Animal', list: 'attrs', index: 0, delta: -1 })),
    ).toEqual(animal(model));
  });
});

describe('relations', () => {
  it('adds a relation of a kind, association by default', async () => {
    const model = await template();
    const added = addRelation(model, { from: 'Dog', to: 'Cat' });
    expect(added.id).toBe('R:Dog:Cat:0');
    expect(added.model.relations.at(-1)).toMatchObject({ t1: 'none', t2: 'dep', line: 'solid' });
    expect(
      addRelation(model, { from: 'Dog', to: 'Cat', kindId: 'composition' }).model.relations.at(-1),
    ).toMatchObject({
      t1: 'comp',
      t2: 'none',
    });
    expect(
      addRelation(model, { from: 'A', to: 'B', kindId: 'unknown' }).model.relations.at(-1)!.t2,
    ).toBe('dep');
  });

  it('patches and reverses a relation', async () => {
    const model = await template();
    const id = model.relations[2]!.id;
    expect(updateRelation(model, id, { label: 'has' }).relations[2]!.label).toBe('has');
    expect(reverseRelation(model, id).relations[2]).toMatchObject({
      from: 'Animal',
      to: 'Owner',
      t1: 'none',
      t2: 'agg',
      m1: '0..*',
      m2: '1',
    });
  });

  it('applies a kind, keeping the marker on its end', async () => {
    const model = await template();
    const [inherit, , owns] = model.relations.map((relation) => relation.id);
    expect(setRelationKind(model, inherit!, 'realization').relations[0]).toMatchObject({
      t1: 'ext',
      t2: 'none',
      line: 'dashed',
    });
    expect(setRelationKind(model, inherit!, 'composition').relations[0]).toMatchObject({
      t1: 'none',
      t2: 'comp',
    });
    expect(setRelationKind(model, owns!, 'link').relations[2]).toMatchObject({
      t1: 'none',
      t2: 'none',
    });
    expect(setRelationKind(model, owns!, 'association').relations[2]).toMatchObject({
      t1: 'none',
      t2: 'dep',
    });
    const plain = updateRelation(model, owns!, { t1: 'none' });
    expect(setRelationKind(plain, owns!, 'composition').relations[2]).toMatchObject({
      t1: 'comp',
      t2: 'none',
    });
    expect(setRelationKind(model, owns!, 'nope')).toBe(model);
  });
});

describe('notes', () => {
  it('adds and patches notes, renaming the id when the target changes', async () => {
    const model = await template();
    const added = addNote(model, { text: 'hi', forId: 'Dog' });
    expect(added).toMatchObject({ id: 'note:Dog:0' });
    expect(addNote(model, { text: 'free' }).model.notes[0]).toEqual({
      id: 'note:-:0',
      text: 'free',
      for: '',
      ns: '',
    });
    const moved = updateNote(added.model, 'note:Dog:0', { for: 'Cat' });
    expect(moved.id).toBe('note:Cat:0');
    expect(moved.model.notes[0]).toEqual({ id: 'note:Cat:0', text: 'hi', for: 'Cat', ns: '' });
    expect(updateNote(added.model, 'note:Dog:0', { text: 'x' }).id).toBe('note:Dog:0');
    expect(updateNote(added.model, 'missing', { for: 'Cat' }).id).toBe('missing');
  });
});

describe('namespaces', () => {
  it('moves classes and notes between namespaces', async () => {
    const model = await template();
    const moved = setClassNamespace(model, 'Dog', 'Pets');
    expect(moved.namespaces).toEqual([{ id: 'Pets', label: '' }]);
    expect(setClassNamespace(moved, 'Cat', 'Pets').namespaces).toHaveLength(1);
    expect(setClassNamespace(model, 'Dog', '').namespaces).toEqual([]);
    const noted = addNote(model, { text: 'n' }).model;
    expect(setNoteNamespace(noted, 'note:-:0', 'X').notes[0]!.ns).toBe('X');
  });

  it('groups items into a new namespace', async () => {
    const noted = addNote(await template(), { text: 'n' }).model;
    const { model, id } = groupInNamespace(noted, ['Dog', 'Cat'], ['note:-:0']);
    expect(id).toBe('Namespace1');
    expect(model.classes.filter((item) => item.ns === id).map((item) => item.id)).toEqual([
      'Dog',
      'Cat',
    ]);
    expect(model.notes[0]!.ns).toBe(id);
    expect(groupInNamespace(noted, ['Dog']).model.notes[0]!.ns).toBe('');
  });

  it('ungroups into the parent namespace', async () => {
    const model = await read(CLASS_FIXTURES.namespaces!);
    const nested = setClassNamespace(model, 'Square', 'Outer.Inner.Deeper');
    expect(ungroupNamespace(nested, 'Outer.Inner').classes.map((item) => item.ns)).toEqual([
      'Outer.Deeper',
      'Shapes',
      'Outer',
    ]);
    expect(ungroupNamespace(nested, 'Outer').classes.map((item) => item.ns)).toEqual([
      'Inner.Deeper',
      'Shapes',
      'Inner',
    ]);
  });

  it('renames a namespace and its children', async () => {
    const model = await read(CLASS_FIXTURES.namespaces!);
    expect(
      renameNamespace(model, 'Outer', 'New name').namespaces.map((namespace) => namespace.id),
    ).toEqual(['Shapes', 'New_name', 'New_name.Inner']);
    expect(renameNamespace(model, 'Outer.Inner', 'Core').classes.map((item) => item.ns)).toEqual([
      'Shapes',
      'Shapes',
      'Outer.Core',
    ]);
    expect(renameNamespace(model, 'Outer', ' ')).toBe(model);
    expect(renameNamespace(model, 'Outer', 'Shapes')).toBe(model);
    expect(renameNamespace(model, 'Outer', 'Square')).toBe(model);
  });

  it('patches a namespace', async () => {
    const model = await read(CLASS_FIXTURES.namespaces!);
    expect(updateNamespace(model, 'Shapes', { label: 'All shapes' }).namespaces[0]!.label).toBe(
      'All shapes',
    );
  });
});

describe('deleteItems', () => {
  it('deletes classes with their relations and notes', async () => {
    const model = addNote(await template(), { text: 'n', forId: 'Animal' }).model;
    const next = deleteItems(model, { classIds: ['Animal'] });
    expect(next.classes.map((item) => item.id)).toEqual(['Dog', 'Cat', 'Owner']);
    expect(next.relations).toEqual([]);
    expect(next.notes).toEqual([]);
  });

  it('deletes relations, notes and namespaces, keeping lollipop labels', async () => {
    const model = await read(`${CLASS_FIXTURES.namespaces!}    Square ()-- Bar\n    note "x"\n`);
    const next = deleteItems(model, {
      relationIds: [model.relations[0]!.id],
      noteIds: ['note:-:0'],
      nsIds: ['Shapes'],
      classIds: ['Square'],
    });
    expect(next.relations.map((relation) => relation.from)).toEqual(['Square']);
    expect(next.notes).toEqual([]);
    expect(next.namespaces.map((namespace) => namespace.id)).toEqual(['Outer', 'Outer.Inner']);
    expect(deleteItems(model, {})).toEqual(model);
  });
});
