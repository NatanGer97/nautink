// Pure class-model edits. Each returns a new model (some return { model, id }).
import { ASSOCIATION, KINDS, noteIdFor, relationId, uniqueNsId } from './model.ts';
import { attrFromText, methodFromText, nsParent } from './text.ts';

import type { RelationKind } from './model.ts';
import type {
  ClassAttr,
  ClassItem,
  ClassMark,
  ClassMethod,
  ClassModel,
  ClassNamespace,
  ClassNote,
  ClassRelation,
} from './types.ts';

/** A model edit that also returns the id of the item it created or changed. */
export interface Edited {
  model: ClassModel;
  id: string;
}

export type MemberList = 'attrs' | 'methods';

/** One member of one class. */
export interface MemberRef {
  classId: string;
  list: MemberList;
  index: number;
}

const SIDE_FROM: number = 1;
const SIDE_TO: number = 2;
const BOTH_SIDES: number = SIDE_FROM + SIDE_TO;

function mapClass(model: ClassModel, id: string, edit: (item: ClassItem) => ClassItem): ClassModel {
  return {
    ...model,
    classes: model.classes.map((item: ClassItem) => (item.id === id ? edit(item) : item)),
  };
}

function memberAt<Member>(list: readonly Member[], index: number, classId: string): Member {
  const member: Member | undefined = list[index];
  if (member === undefined) {
    throw new Error(`Class "${classId}" has no member at index ${String(index)}`);
  }
  return member;
}

function withoutIndex<Member>(list: readonly Member[], index: number): Member[] {
  return [...list.slice(0, index), ...list.slice(index + 1)];
}

function replaceAt<Member>(list: readonly Member[], index: number, member: Member): Member[] {
  return list.map((existing: Member, at: number) => (at === index ? member : existing));
}

/** Adds a class; every field but `id` defaults to empty. */
export function addClass(
  model: ClassModel,
  item: Pick<ClassItem, 'id'> & Partial<ClassItem>,
): ClassModel {
  const added: ClassItem = {
    label: '',
    generic: '',
    annotations: [],
    attrs: [],
    methods: [],
    css: [],
    ns: '',
    ...item,
  };
  return { ...model, classes: [...model.classes, added] };
}

export function updateClass(model: ClassModel, id: string, patch: Partial<ClassItem>): ClassModel {
  return mapClass(model, id, (item: ClassItem) => ({ ...item, ...patch }));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renameEnds(relation: ClassRelation, oldId: string, newId: string): ClassRelation {
  const from: string = relation.t1 !== 'lolli' && relation.from === oldId ? newId : relation.from;
  const to: string = relation.t2 !== 'lolli' && relation.to === oldId ? newId : relation.to;
  return from === relation.from && to === relation.to ? relation : { ...relation, from, to };
}

function renameInLines(lines: readonly string[], oldId: string, newId: string): string[] {
  const reference: RegExp = new RegExp(`(^|[\\s,"])${escapeRegExp(oldId)}(?=$|[\\s,"])`, 'g');
  return lines.map((line: string) =>
    /^(style|cssClass|click|link|callback)\b/.test(line)
      ? line.replace(reference, `$1${newId}`)
      : line,
  );
}

/** Renames a class everywhere it is referenced. Unchanged when the new id is empty or taken. */
export function renameClass(model: ClassModel, oldId: string, newId: string): ClassModel {
  const id: string = newId.trim();
  if (!id || id === oldId || model.classes.some((item: ClassItem) => item.id === id)) {
    return model;
  }
  return {
    ...model,
    classes: model.classes.map((item: ClassItem) => (item.id === oldId ? { ...item, id } : item)),
    relations: model.relations.map((relation: ClassRelation) => renameEnds(relation, oldId, id)),
    notes: model.notes.map((note: ClassNote) => (note.for === oldId ? { ...note, for: id } : note)),
    extra: renameInLines(model.extra, oldId, id),
  };
}

// ---- members ----

export function addAttr(
  model: ClassModel,
  classId: string,
  attr: ClassAttr = { vis: '+', text: 'attribute', cls: '' },
): ClassModel {
  return mapClass(model, classId, (item: ClassItem) => ({ ...item, attrs: [...item.attrs, attr] }));
}

export function addMethod(
  model: ClassModel,
  classId: string,
  method: ClassMethod = { vis: '+', name: 'method', params: '', ret: '', cls: '' },
): ClassModel {
  return mapClass(model, classId, (item: ClassItem) => ({
    ...item,
    methods: [...item.methods, method],
  }));
}

export interface AttrPatch {
  classId: string;
  index: number;
  patch: Partial<ClassAttr>;
}

function patchedAttr(attr: ClassAttr, patch: Partial<ClassAttr>): ClassAttr {
  const next: ClassAttr = { ...attr, ...patch };
  if (patch.text === undefined) {
    return next;
  }
  const typed: ClassAttr = attrFromText(patch.text);
  return { text: typed.text, vis: typed.vis || next.vis, cls: typed.cls || next.cls };
}

/** Patches an attribute. Text typed with a leading visibility or trailing `$`/`*` is normalized. */
export function updateAttr(model: ClassModel, { classId, index, patch }: AttrPatch): ClassModel {
  return mapClass(model, classId, (item: ClassItem) => {
    const next: ClassAttr = patchedAttr(memberAt(item.attrs, index, classId), patch);
    const attr: ClassAttr = { ...next, text: next.text.replace(/[(){}]/g, '') };
    return { ...item, attrs: replaceAt(item.attrs, index, attr) };
  });
}

export interface MethodPatch {
  classId: string;
  index: number;
  patch: Partial<ClassMethod>;
}

function cleanMethod(method: ClassMethod): ClassMethod {
  const clean = (text: string): string => text.replace(/[\r\n{}]/g, ' ');
  return {
    ...method,
    name: clean(method.name).replace(/[()]/g, '').trim(),
    params: clean(method.params).replace(/[()]/g, ''),
    ret: clean(method.ret)
      .replace(/[$*]+$/, '')
      .trim(),
  };
}

export function updateMethod(
  model: ClassModel,
  { classId, index, patch }: MethodPatch,
): ClassModel {
  return mapClass(model, classId, (item: ClassItem) => {
    const method: ClassMethod = cleanMethod({
      ...memberAt(item.methods, index, classId),
      ...patch,
    });
    return { ...item, methods: replaceAt(item.methods, index, method) };
  });
}

/** Removes one member. */
export function removeMember(model: ClassModel, { classId, list, index }: MemberRef): ClassModel {
  return mapClass(model, classId, (item: ClassItem) => ({
    ...item,
    [list]: withoutIndex<ClassAttr | ClassMethod>(item[list], index),
  }));
}

type TypedMember = { list: 'attrs'; member: ClassAttr } | { list: 'methods'; member: ClassMethod };

// Like Mermaid: text with ")" is a method, anything else an attribute.
function typedMember(text: string): TypedMember | null {
  if (!text.includes(')')) {
    const attr: ClassAttr = attrFromText(text);
    return { list: 'attrs', member: { ...attr, text: attr.text.replace(/[(){}]/g, '') } };
  }
  const method: ClassMethod | null = methodFromText(text);
  if (method === null) {
    return null;
  }
  const strip = (part: string): string => part.replace(/[(){}]/g, '');
  return {
    list: 'methods',
    member: { ...method, name: strip(method.name), params: strip(method.params) },
  };
}

function placeMember(item: ClassItem, ref: MemberRef, typed: TypedMember): ClassItem {
  const rest: ClassItem = {
    ...item,
    [ref.list]: withoutIndex<ClassAttr | ClassMethod>(item[ref.list], ref.index),
  };
  if (typed.list === 'attrs') {
    return ref.list === 'attrs'
      ? { ...item, attrs: replaceAt(item.attrs, ref.index, typed.member) }
      : { ...rest, attrs: [...rest.attrs, typed.member] };
  }
  return ref.list === 'methods'
    ? { ...item, methods: replaceAt(item.methods, ref.index, typed.member) }
    : { ...rest, methods: [...rest.methods, typed.member] };
}

/**
 * Replaces a member from one line of text (inline canvas editing). Empty text removes it; typing
 * a method into an attribute row (or the reverse) moves the member to the other compartment.
 */
export function setMemberText(model: ClassModel, ref: MemberRef & { text: string }): ClassModel {
  if (!ref.text.trim()) {
    return removeMember(model, ref);
  }
  const typed: TypedMember | null = typedMember(ref.text);
  if (typed === null) {
    return model;
  }
  return mapClass(model, ref.classId, (item: ClassItem) => placeMember(item, ref, typed));
}

/** Swaps a member with its neighbour `delta` places away; unchanged at either end. */
export function moveMember(model: ClassModel, ref: MemberRef & { delta: number }): ClassModel {
  return mapClass(model, ref.classId, (item: ClassItem) => {
    const list: (ClassAttr | ClassMethod)[] = [...item[ref.list]];
    const target: number = ref.index + ref.delta;
    const moving: ClassAttr | ClassMethod | undefined = list[ref.index];
    const other: ClassAttr | ClassMethod | undefined = list[target];
    if (moving === undefined || other === undefined) {
      return item;
    }
    list[ref.index] = other;
    list[target] = moving;
    return { ...item, [ref.list]: list };
  });
}

/** Sets the class's primary stereotype (its first annotation). '' removes it. */
export function setStereotype(model: ClassModel, classId: string, value: string): ClassModel {
  return mapClass(model, classId, (item: ClassItem) => {
    const rest: string[] = item.annotations.slice(1);
    const stereotype: string = value.replace(/[<>«»]/g, '').trim();
    return { ...item, annotations: stereotype ? [stereotype, ...rest] : rest };
  });
}

// ---- relations ----

export interface NewRelation {
  from: string;
  to: string;
  kindId?: string;
}

function kindById(id: string): RelationKind | undefined {
  return KINDS.find((kind: RelationKind) => kind.id === id);
}

/** Adds a relation of a toolbar kind (association by default). */
export function addRelation(
  model: ClassModel,
  { from, to, kindId = 'association' }: NewRelation,
): Edited {
  const kind: RelationKind = kindById(kindId) ?? ASSOCIATION;
  const relation: ClassRelation = {
    id: relationId(model.relations, from, to),
    from,
    to,
    t1: kind.side === SIDE_FROM ? kind.mark : 'none',
    t2: kind.side === SIDE_TO ? kind.mark : 'none',
    line: kind.line,
    label: '',
    m1: '',
    m2: '',
  };
  return { model: { ...model, relations: [...model.relations, relation] }, id: relation.id };
}

export function updateRelation(
  model: ClassModel,
  id: string,
  patch: Partial<ClassRelation>,
): ClassModel {
  return {
    ...model,
    relations: model.relations.map((relation: ClassRelation) =>
      relation.id === id ? { ...relation, ...patch } : relation,
    ),
  };
}

function markedSide(relation: ClassRelation): number {
  if (relation.t1 !== 'none' && relation.t2 === 'none') {
    return SIDE_FROM;
  }
  return relation.t2 !== 'none' && relation.t1 === 'none' ? SIDE_TO : 0;
}

// Keeps the drag orientation: `A <|-- B` (B extends A) as realization gives `A <|.. B`.
function sideFor(relation: ClassRelation, kind: RelationKind): number {
  const side: number = markedSide(relation);
  const mark: ClassMark = side === SIDE_FROM ? relation.t1 : relation.t2;
  const current: RelationKind | undefined = side
    ? KINDS.find((known: RelationKind) => known.mark === mark)
    : undefined;
  if (current === undefined) {
    return kind.side;
  }
  if (kind.mark === 'none') {
    return SIDE_TO;
  }
  return side === current.side ? kind.side : BOTH_SIDES - kind.side;
}

/** Applies a toolbar kind, keeping the marker on the end it is already on. */
export function setRelationKind(model: ClassModel, id: string, kindId: string): ClassModel {
  const kind: RelationKind | undefined = kindById(kindId);
  if (!kind) {
    return model;
  }
  return {
    ...model,
    relations: model.relations.map((relation: ClassRelation) => {
      if (relation.id !== id) {
        return relation;
      }
      const side: number = sideFor(relation, kind);
      const t1: ClassMark = side === SIDE_FROM ? kind.mark : 'none';
      return { ...relation, line: kind.line, t1, t2: side === SIDE_TO ? kind.mark : 'none' };
    }),
  };
}

export function reverseRelation(model: ClassModel, id: string): ClassModel {
  return {
    ...model,
    relations: model.relations.map((relation: ClassRelation) =>
      relation.id === id
        ? {
            ...relation,
            from: relation.to,
            to: relation.from,
            t1: relation.t2,
            t2: relation.t1,
            m1: relation.m2,
            m2: relation.m1,
          }
        : relation,
    ),
  };
}

// ---- notes ----

export interface NewNote {
  text: string;
  forId?: string;
  ns?: string;
}

export function addNote(model: ClassModel, { text, forId = '', ns = '' }: NewNote): Edited {
  const id: string = noteIdFor(model.notes, forId);
  return { model: { ...model, notes: [...model.notes, { id, text, for: forId, ns }] }, id };
}

/** Patches a note. Re-attaching it to another class gives it a new id. */
export function updateNote(model: ClassModel, id: string, patch: Partial<ClassNote>): Edited {
  const note: ClassNote | undefined = model.notes.find((existing: ClassNote) => existing.id === id);
  const isMoved: boolean = note !== undefined && patch.for !== undefined && patch.for !== note.for;
  const newId: string = isMoved ? noteIdFor(model.notes, patch.for ?? '') : id;
  const notes: ClassNote[] = model.notes.map((existing: ClassNote) =>
    existing.id === id ? { ...existing, ...patch, id: newId } : existing,
  );
  return { model: { ...model, notes }, id: newId };
}

// ---- namespaces ----

export function setClassNamespace(model: ClassModel, classId: string, ns: string): ClassModel {
  const next: ClassModel = mapClass(model, classId, (item: ClassItem) => ({ ...item, ns }));
  if (!ns || next.namespaces.some((namespace: ClassNamespace) => namespace.id === ns)) {
    return next;
  }
  return { ...next, namespaces: [...next.namespaces, { id: ns, label: '' }] };
}

export function setNoteNamespace(model: ClassModel, noteId: string, ns: string): ClassModel {
  return {
    ...model,
    notes: model.notes.map((note: ClassNote) => (note.id === noteId ? { ...note, ns } : note)),
  };
}

/** Puts classes and notes into a new namespace. */
export function groupInNamespace(
  model: ClassModel,
  classIds: readonly string[],
  noteIds: readonly string[] = [],
): Edited {
  const id: string = uniqueNsId(model);
  return {
    model: {
      ...model,
      namespaces: [...model.namespaces, { id, label: '' }],
      classes: model.classes.map((item: ClassItem) =>
        classIds.includes(item.id) ? { ...item, ns: id } : item,
      ),
      notes: model.notes.map((note: ClassNote) =>
        noteIds.includes(note.id) ? { ...note, ns: id } : note,
      ),
    },
    id,
  };
}

function moveNamespaces(model: ClassModel, move: (ns: string) => string): ClassModel {
  return {
    ...model,
    namespaces: model.namespaces.map((namespace: ClassNamespace) => ({
      ...namespace,
      id: move(namespace.id),
    })),
    classes: model.classes.map((item: ClassItem) => ({ ...item, ns: move(item.ns) })),
    notes: model.notes.map((note: ClassNote) => ({ ...note, ns: move(note.ns) })),
  };
}

/** Removes a namespace; its content moves to the parent namespace. */
export function ungroupNamespace(model: ClassModel, id: string): ClassModel {
  const parent: string = nsParent(id);
  const prefix: string = parent ? `${parent}.` : '';
  const lift = (ns: string): string => {
    if (ns === id) {
      return parent;
    }
    return ns.startsWith(`${id}.`) ? prefix + ns.slice(id.length + 1) : ns;
  };
  const kept: ClassModel = {
    ...model,
    namespaces: model.namespaces.filter((namespace: ClassNamespace) => namespace.id !== id),
  };
  return moveNamespaces(kept, lift);
}

/** Renames the last segment of a namespace id; children follow. Unchanged when invalid or taken. */
export function renameNamespace(model: ClassModel, id: string, name: string): ClassModel {
  const leaf: string = name.trim().replace(/[\s.{}"`]/g, '_');
  const parent: string = nsParent(id);
  const newId: string = parent ? `${parent}.${leaf}` : leaf;
  const isTaken: boolean =
    model.namespaces.some((namespace: ClassNamespace) => namespace.id === newId) ||
    model.classes.some((item: ClassItem) => item.id === newId);
  if (!leaf || newId === id || isTaken) {
    return model;
  }
  return moveNamespaces(model, (ns: string): string => {
    if (ns === id) {
      return newId;
    }
    return ns.startsWith(`${id}.`) ? newId + ns.slice(id.length) : ns;
  });
}

export function updateNamespace(
  model: ClassModel,
  id: string,
  patch: Partial<ClassNamespace>,
): ClassModel {
  return {
    ...model,
    namespaces: model.namespaces.map((namespace: ClassNamespace) =>
      namespace.id === id ? { ...namespace, ...patch } : namespace,
    ),
  };
}

// ---- delete ----

export interface ClassSelection {
  classIds?: readonly string[];
  noteIds?: readonly string[];
  relationIds?: readonly string[];
  nsIds?: readonly string[];
}

/** Deletes classes (with their relations and notes), notes, relations and namespaces (keeping content). */
export function deleteItems(
  model: ClassModel,
  { classIds = [], noteIds = [], relationIds = [], nsIds = [] }: ClassSelection,
): ClassModel {
  const next: ClassModel = nsIds.reduce(ungroupNamespace, model);
  const touches = (relation: ClassRelation): boolean =>
    (relation.t1 !== 'lolli' && classIds.includes(relation.from)) ||
    (relation.t2 !== 'lolli' && classIds.includes(relation.to));
  return {
    ...next,
    classes: next.classes.filter((item: ClassItem) => !classIds.includes(item.id)),
    relations: next.relations.filter(
      (relation: ClassRelation) => !relationIds.includes(relation.id) && !touches(relation),
    ),
    notes: next.notes.filter(
      (note: ClassNote) => !noteIds.includes(note.id) && !classIds.includes(note.for),
    ),
  };
}
