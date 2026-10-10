// Namespace edits as labelled undo steps (v1's ClassEditor `actions`).
import { freeSpot } from '@nautink/editors/class/layout';
import { classSize } from '@nautink/editors/class/measure';
import { uniqueNsId } from '@nautink/editors/class/model';
import * as ops from '@nautink/editors/class/ops';
import { nsParent } from '@nautink/editors/class/text';
import { editLabel } from '@nautink/visual-core/labels';
import { clip } from '@nautink/visual-core/text';

import { run } from './class-action-context.ts';
import { classBoxes } from './class-boxes.ts';
import { className, itemKind } from './class-names.ts';
import { FRAME_PREFIX, NO_SELECTION } from './class-types.ts';
import { canvasTextMeasurer } from '../canvas/text-measurer.ts';

import type { ClassActionContext } from './class-action-context.ts';
import type { ClassItem, ClassModel, ClassNamespace } from '@nautink/editors/class/types';
import type { Point, Rect, Size } from '@nautink/visual-core/geometry';
import type { PositionMap } from '@nautink/visual-core/positions';
import type { TextMeasurer } from '@nautink/visual-core/text-measure';

/** The inspector's "New namespace…" choice. */
export const NEW_NAMESPACE: string = '__new';
const NS_CLIP: number = 24;
const FRAME_INSET: number = 20;
const BELOW_FRAME: number = 10;

function namespaceId(model: ClassModel, choice: string): string {
  return choice === NEW_NAMESPACE ? uniqueNsId(model) : choice;
}

/** Moving a class into an existing namespace puts it under that frame's content (v1). */
function placeInFrame(
  context: ClassActionContext,
  next: ClassModel,
  { id, ns }: { id: string; ns: string },
): void {
  const frame: Rect | undefined = classBoxes(next, context.positions.get()).get(FRAME_PREFIX + ns);
  const item: ClassItem | undefined = next.classes.find((candidate) => candidate.id === id);
  if (frame === undefined || item === undefined) {
    return;
  }
  const others: PositionMap = Object.fromEntries(
    Object.entries(context.positions.get()).filter(([key]) => key !== id),
  );
  const start: Point = { x: frame.x + FRAME_INSET, y: frame.y + frame.h + BELOW_FRAME };
  const size: Size = classSize(item, canvasTextMeasurer);
  const measure: TextMeasurer = canvasTextMeasurer;
  context.positions.set(id, freeSpot({ model: next, positions: others, size, start, measure }));
}

export function setClassNamespace(context: ClassActionContext, id: string, choice: string): void {
  const model: ClassModel | null = context.getModel();
  if (model === null) {
    return;
  }
  const ns: string = namespaceId(model, choice);
  const isExisting: boolean =
    ns !== '' && classBoxes(model, context.positions.get()).has(FRAME_PREFIX + ns);
  const next: ClassModel = ops.setClassNamespace(model, id, ns);
  if (isExisting) {
    placeInFrame(context, next, { id, ns });
  }
  const name: string = className(model, id);
  context.commit(
    next,
    ns === '' ? `Moved ${name} out of its namespace` : `Moved ${name} into ${ns}`,
  );
}

export function setNoteNamespace(context: ClassActionContext, id: string, choice: string): void {
  run(context, (model) => {
    const ns: string = namespaceId(model, choice);
    return [
      ops.setNoteNamespace(model, id, ns),
      ns === '' ? 'Moved note out of its namespace' : `Moved note into ${ns}`,
    ];
  });
}

/** Puts the selected classes and notes in a new namespace, and selects it. */
export function groupInNamespace(context: ClassActionContext, ids: readonly string[]): void {
  const model: ClassModel | null = context.getModel();
  const classIds: string[] =
    model === null ? [] : ids.filter((id) => itemKind(model, id) === 'class');
  const noteIds: string[] =
    model === null ? [] : ids.filter((id) => itemKind(model, id) === 'note');
  if (model === null || classIds.length + noteIds.length === 0) {
    return;
  }
  const { model: next, id } = ops.groupInNamespace(model, classIds, noteIds);
  context.commit(next, `Grouped ${String(classIds.length + noteIds.length)} items in a namespace`);
  context.select({ ...NO_SELECTION, group: id });
}

export function ungroupNamespace(context: ClassActionContext, id: string): void {
  run(context, (model) => [ops.ungroupNamespace(model, id), `Ungrouped namespace ${id}`]);
  context.select(NO_SELECTION);
}

/** Renames a namespace's last segment (children follow) and keeps it selected. */
export function renameNamespace(context: ClassActionContext, id: string, name: string): void {
  const model: ClassModel | null = context.getModel();
  const next: ClassModel | null = model === null ? null : ops.renameNamespace(model, id, name);
  if (next === null || next === model) {
    return;
  }
  const leaf: string = name.trim().replace(/[\s.{}"`]/g, '_');
  context.commit(next, `Renamed namespace ${clip(id, NS_CLIP)} → ${clip(name, NS_CLIP)}`);
  context.select({
    ...NO_SELECTION,
    group: nsParent(id) === '' ? leaf : `${nsParent(id)}.${leaf}`,
  });
}

/** Patches a namespace; an implicit one (only named by a dotted id) is declared first. */
export function updateNamespace(
  context: ClassActionContext,
  id: string,
  patch: Partial<ClassNamespace>,
): void {
  run(context, (model) => {
    const isDeclared: boolean = model.namespaces.some((namespace) => namespace.id === id);
    const next: ClassModel = isDeclared
      ? ops.updateNamespace(model, id, patch)
      : { ...model, namespaces: [...model.namespaces, { id, label: '', ...patch }] };
    return [next, editLabel('namespace', id, patch)];
  });
}
