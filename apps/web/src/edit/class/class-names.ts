import { relationEnds } from '@nautink/editors/class/layout';
import { readable } from '@nautink/editors/class/text';
import { clip } from '@nautink/visual-core/text';

import type { MemberList } from '@nautink/editors/class/ops';
import type { ClassItem, ClassModel, ClassRelation } from '@nautink/editors/class/types';

const NAME_CLIP: number = 28;

/** A class's name in step labels: its display label, else its id. */
export function className(model: ClassModel, id: string): string {
  const item: ClassItem | undefined = model.classes.find((candidate) => candidate.id === id);
  return clip(
    readable(item?.label !== undefined && item.label !== '' ? item.label : id),
    NAME_CLIP,
  );
}

/** "Order → Payment" for a relation, or '' when there is no such relation. */
export function relationName(model: ClassModel, id: string): string {
  const relation: ClassRelation | undefined = model.relations.find((item) => item.id === id);
  if (relation === undefined) {
    return '';
  }
  return `${className(model, relation.from)} → ${className(model, relation.to)}`;
}

/** "attribute" or "method". */
export function memberWord(list: MemberList): string {
  return list === 'methods' ? 'method' : 'attribute';
}

/** Whether `id` is a class, a note or a relation's lollipop circle in `model`. */
export function itemKind(model: ClassModel, id: string): 'class' | 'note' | 'lolli' | null {
  if (model.classes.some((item) => item.id === id)) {
    return 'class';
  }
  if (model.notes.some((note) => note.id === id)) {
    return 'note';
  }
  const isLolli: boolean = model.relations.some((relation) => relationEnds(relation).includes(id));
  return isLolli && id.startsWith('lolli:') ? 'lolli' : null;
}
