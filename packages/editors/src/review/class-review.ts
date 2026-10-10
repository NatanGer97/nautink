// A class diagram as review elements: classes (with their members), relations and notes.
import { removedRefs, signature } from './review-element.ts';
import { classEditor } from '../class/model.ts';

import type { ReviewAdapter } from './review-adapter.ts';
import type { ReviewElement } from './review-element.ts';
import type { ClassItem, ClassModel, ClassNote, ClassRelation } from '../class/types.ts';

function classElement(item: ClassItem): ReviewElement {
  const { id, ...fields } = item;
  return { id, kind: 'node', key: `class:${id}`, sig: signature(fields), label: item.label || id };
}

function relationElement(relation: ClassRelation): ReviewElement {
  const { id, from, to, ...fields } = relation;
  return {
    id,
    kind: 'edge',
    key: `relation:${from}>${to}`,
    sig: signature(fields),
    label: relation.label || `${from} → ${to}`,
    ends: [from, to],
  };
}

function noteElement(note: ClassNote): ReviewElement {
  return { id: note.id, kind: 'note', key: `note:${note.for}`, sig: note.text, label: note.text };
}

/** Classes, relations, then notes. A changed member marks its class as changed. */
export function classElements(model: ClassModel): ReviewElement[] {
  return [
    ...model.classes.map(classElement),
    ...model.relations.map(relationElement),
    ...model.notes.map(noteElement),
  ];
}

/** The proposal plus what it removed; namespaces follow their classes when serialized. */
export function classUnion(before: ClassModel, after: ClassModel): ClassModel {
  const removed: Set<string> = removedRefs(classElements(before), classElements(after));
  return {
    ...after,
    classes: [...after.classes, ...before.classes.filter((item) => removed.has(`node:${item.id}`))],
    relations: [
      ...after.relations,
      ...before.relations.filter((relation) => removed.has(`edge:${relation.id}`)),
    ],
    notes: [...after.notes, ...before.notes.filter((note) => removed.has(`note:${note.id}`))],
  };
}

export const classReview: ReviewAdapter<ClassModel> = {
  module: classEditor,
  elements: classElements,
  union: classUnion,
};
