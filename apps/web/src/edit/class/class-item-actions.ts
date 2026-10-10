// Class, connect, delete, duplicate and direction edits as labelled undo steps (v1's ClassEditor
// `actions`, `onConnect`, `deleteIds`).
import { dagreLayout, lolliId } from '@nautink/editors/class/layout';
import * as ops from '@nautink/editors/class/ops';
import { deleteLabel, editLabel } from '@nautink/visual-core/labels';
import { clip } from '@nautink/visual-core/text';

import { movePosition, run } from './class-action-context.ts';
import { DUPLICATE_OFFSET } from './class-actions.ts';
import { className, itemKind, relationName } from './class-names.ts';
import { updateNote } from './class-note-actions.ts';
import { FRAME_PREFIX, NO_SELECTION } from './class-types.ts';
import { canvasTextMeasurer } from '../canvas/text-measurer.ts';

import type { ClassActionContext } from './class-action-context.ts';
import type { ClassSelection } from './class-types.ts';
import type { ClassSelection as OpsSelection } from '@nautink/editors/class/ops';
import type { ClassDirection, ClassItem, ClassModel } from '@nautink/editors/class/types';
import type { Point } from '@nautink/visual-core/geometry';
import type { PositionMap } from '@nautink/visual-core/positions';

const NAME_CLIP: number = 28;

export function updateClass(
  context: ClassActionContext,
  id: string,
  patch: Partial<ClassItem>,
): void {
  run(context, (model) => [
    ops.updateClass(model, id, patch),
    editLabel('class', className(model, id), patch),
  ]);
}

/** Renames a class id everywhere; nothing happens when the new id is empty or taken. */
export function renameClassId(context: ClassActionContext, id: string, newId: string): void {
  const model: ClassModel | null = context.getModel();
  const target: string = newId.trim();
  const next: ClassModel | null = model === null ? null : ops.renameClass(model, id, target);
  if (next === null || next === model) {
    return;
  }
  movePosition(context, id, target);
  context.commit(next, `Renamed ${clip(id, NAME_CLIP)} → ${clip(target, NAME_CLIP)}`);
  context.select({ ...NO_SELECTION, nodes: [target] });
}

/** Inline rename on the canvas: the display label when there is one, else the id (v1). */
export function renameFromCanvas(context: ClassActionContext, id: string, text: string): void {
  const model: ClassModel | null = context.getModel();
  const item: ClassItem | undefined = model?.classes.find((candidate) => candidate.id === id);
  const name: string = text.trim();
  if (item === undefined || name === '') {
    return;
  }
  if (item.label === '') {
    renameClassId(context, id, name);
    return;
  }
  if (name !== item.label) {
    const label: string = `Renamed ${clip(item.label, NAME_CLIP)} → ${clip(name, NAME_CLIP)}`;
    run(context, (current) => [ops.updateClass(current, id, { label: name }), label]);
  }
}

export function setStereotype(context: ClassActionContext, id: string, value: string): void {
  run(context, (model) => [
    ops.setStereotype(model, id, value),
    value === ''
      ? `Cleared stereotype of ${className(model, id)}`
      : `Made ${className(model, id)} ${value}`,
  ]);
}

/** Whether a link may join these two items: two classes, or a note and a class. */
export function canConnect(model: ClassModel | null, source: string, target: string): boolean {
  if (model === null) {
    return false;
  }
  const kinds: string = `${itemKind(model, source) ?? ''}-${itemKind(model, target) ?? ''}`;
  return kinds === 'class-class' || kinds === 'note-class' || kinds === 'class-note';
}

function linkClasses(
  context: ClassActionContext,
  model: ClassModel,
  request: { source: string; target: string; kindId: string },
): void {
  const { source, target, kindId } = request;
  const { model: next, id } = ops.addRelation(model, { from: source, to: target, kindId });
  context.commit(next, `Connected ${className(model, source)} → ${className(model, target)}`);
  context.select({ ...NO_SELECTION, edges: [id] });
}

/** Links two classes with the toolbar's kind, or attaches a note to a class. */
export function connect(
  context: ClassActionContext,
  request: { source: string; target: string; kindId: string },
): void {
  const model: ClassModel | null = context.getModel();
  if (model === null || !canConnect(model, request.source, request.target)) {
    return;
  }
  const { source, target } = request;
  if (itemKind(model, source) === 'class' && itemKind(model, target) === 'class') {
    linkClasses(context, model, request);
    return;
  }
  const isNoteFirst: boolean = itemKind(model, source) === 'note';
  updateNote(context, isNoteFirst ? source : target, { for: isNoteFirst ? target : source });
}

/** The model ids a canvas selection deletes: frames are namespaces, lollipops their relations. */
export function deletedIds(model: ClassModel, selection: ClassSelection): Required<OpsSelection> {
  const nodes: readonly string[] = selection.nodes;
  const frames: string[] = nodes
    .filter((id) => id.startsWith(FRAME_PREFIX))
    .map((id) => id.slice(FRAME_PREFIX.length));
  const lollipops: string[] = model.relations
    .filter((relation) => nodes.includes(lolliId(relation)))
    .map((relation) => relation.id);
  return {
    classIds: nodes.filter((id) => itemKind(model, id) === 'class'),
    noteIds: nodes.filter((id) => itemKind(model, id) === 'note'),
    relationIds: [...new Set<string>([...selection.edges, ...lollipops])],
    nsIds: [
      ...new Set<string>([...frames, ...(selection.group === null ? [] : [selection.group])]),
    ],
  };
}

/** The names a delete step lists: relations that go with their classes are not counted (v1). */
export function deletedNames(model: ClassModel, ids: Required<OpsSelection>): string[] {
  const goesWithClass = (id: string): boolean =>
    model.relations.some(
      (relation) =>
        relation.id === id &&
        (ids.classIds.includes(relation.from) || ids.classIds.includes(relation.to)),
    );
  return [
    ...ids.classIds.map((id) => className(model, id)),
    ...ids.noteIds.map(() => 'note'),
    ...ids.relationIds
      .filter((id) => !goesWithClass(id))
      .map((id) => `relation ${relationName(model, id)}`),
    ...ids.nsIds,
  ];
}

/** Deletes the selection as one step: classes (with their relations and notes), notes, relations and namespaces (keeping their content). */
export function deleteSelection(context: ClassActionContext, selection: ClassSelection): void {
  const model: ClassModel | null = context.getModel();
  if (model === null) {
    return;
  }
  const ids: Required<OpsSelection> = deletedIds(model, selection);
  const names: string[] = deletedNames(model, ids);
  if (names.length === 0) {
    return;
  }
  context.commit(ops.deleteItems(model, ids), deleteLabel(names));
  context.select(NO_SELECTION);
}

function placeCopies(context: ClassActionContext, copies: ReadonlyMap<string, string>): void {
  const positions: PositionMap = context.positions.get();
  for (const [original, copy] of copies) {
    const from: Point = (Object.hasOwn(positions, original) ? positions[original] : undefined) ?? {
      x: 0,
      y: 0,
    };
    context.positions.set(copy, { x: from.x + DUPLICATE_OFFSET, y: from.y + DUPLICATE_OFFSET });
  }
}

/** Copies the selected classes (with the relations between them) and selects the copies. */
export function duplicateClasses(context: ClassActionContext, ids: readonly string[]): void {
  const model: ClassModel | null = context.getModel();
  const classIds: string[] =
    model === null ? [] : ids.filter((id) => itemKind(model, id) === 'class');
  if (model === null || classIds.length === 0) {
    return;
  }
  const { model: next, copies } = ops.duplicateClasses(model, classIds);
  const [first = ''] = copies.keys();
  placeCopies(context, copies);
  context.commit(
    next,
    copies.size === 1
      ? `Duplicated ${className(model, first)}`
      : `Duplicated ${String(copies.size)} classes`,
  );
  context.select({ ...NO_SELECTION, nodes: [...copies.values()] });
}

/** Changes the direction and lays the diagram out again in it (v1). */
export function setDirection(context: ClassActionContext, direction: ClassDirection): void {
  const model: ClassModel | null = context.getModel();
  if (model === null || model.direction === direction) {
    return;
  }
  const next: ClassModel = { ...model, direction, isDirExplicit: true };
  context.positions.replace({
    ...context.positions.get(),
    ...dagreLayout(next, canvasTextMeasurer),
  });
  context.commit(next, `Changed direction to ${direction}`);
  context.requestFit();
}
