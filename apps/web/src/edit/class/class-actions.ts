// Class edits on the canvas as labelled undo steps (v1's ClassEditor `addItem`, `onConnect`,
// `deleteIds`, `renameClass`, `setDirection`).
import { freeSpot } from '@nautink/editors/class/layout';
import { classSize, noteSize } from '@nautink/editors/class/measure';
import { uniqueClassId } from '@nautink/editors/class/model';
import * as ops from '@nautink/editors/class/ops';

import { className, itemKind } from './class-names.ts';
import { paletteItem } from './class-palette.ts';
import { NO_SELECTION } from './class-types.ts';
import { canvasTextMeasurer } from '../canvas/text-measurer.ts';

import type { ClassActionContext } from './class-action-context.ts';
import type { PaletteItem, PaletteKind } from './class-palette.ts';
import type { ClassEditing, ClassSelection } from './class-types.ts';
import type { ClassItem, ClassModel } from '@nautink/editors/class/types';
import type { Point, Size } from '@nautink/visual-core/geometry';
import type { Position, PositionMap } from '@nautink/visual-core/positions';

const HALF: number = 0.5;
/** A note added for a class lands this far right of it. */
const NOTE_GAP: number = 40;
/** A duplicate lands this far right and down of its original. */
export const DUPLICATE_OFFSET: number = 24;

export interface AddItemRequest {
  kind: PaletteKind;
  /** Where the item's centre should go, in canvas coordinates. */
  at: Point;
  /** The selection decides where it goes: a selected namespace, or the class a note is for. */
  selection: ClassSelection;
  /** The toolbar's kind for new links (a link dropped on empty canvas). */
  relationKind: string;
  /** A link drawn from this class and dropped on empty canvas makes the new class. */
  connectFrom?: string;
}

function centeredAt(at: Point, size: Size): Point {
  return { x: at.x - size.width * HALF, y: at.y - size.height * HALF };
}

function spotOf(positions: PositionMap, id: string): Position | undefined {
  return Object.hasOwn(positions, id) ? positions[id] : undefined;
}

function findClass(model: ClassModel, id: string): ClassItem | undefined {
  return model.classes.find((item) => item.id === id);
}

/** The class a new note is for: the one selected class, if that is all that is selected. */
function noteOwner(model: ClassModel, selection: ClassSelection): string {
  const [only] = selection.nodes;
  return selection.nodes.length === 1 && only !== undefined && itemKind(model, only) === 'class'
    ? only
    : '';
}

/** Where a note for `forId` starts: right of its class, else centred at `at`. */
export function noteStart(context: ClassActionContext, forId: string, at: Point): Point {
  const model: ClassModel | null = context.getModel();
  const owner: ClassItem | undefined = model === null ? undefined : findClass(model, forId);
  const spot: Position | undefined = spotOf(context.positions.get(), forId);
  if (owner === undefined || spot === undefined) {
    return centeredAt(at, noteSize({ id: '', text: 'Note', for: '', ns: '' }, canvasTextMeasurer));
  }
  return { x: spot.x + classSize(owner, canvasTextMeasurer).width + NOTE_GAP, y: spot.y };
}

/** The nearest free spot to `start` for an item of `size`. */
export function freeSpotFor(
  context: ClassActionContext,
  model: ClassModel,
  { size, start }: { size: Size; start: Point },
): Point {
  const positions: PositionMap = context.positions.get();
  return freeSpot({ model, positions, size, start, measure: canvasTextMeasurer });
}

function selectForEditing(context: ClassActionContext, editing: ClassEditing): void {
  context.select({ ...NO_SELECTION, nodes: [editing.id] });
  context.setEditing(editing);
}

/** Adds a note (for `forId`, or free in `ns`), places it, and opens it for editing. */
export function addNote(
  context: ClassActionContext,
  request: { forId: string; ns: string; start: Point },
): void {
  const model: ClassModel | null = context.getModel();
  if (model === null) {
    return;
  }
  const { model: next, id } = ops.addNote(model, { text: 'Note', ...request });
  const size: Size = noteSize({ id, text: 'Note', for: '', ns: '' }, canvasTextMeasurer);
  context.positions.set(id, freeSpotFor(context, model, { size, start: request.start }));
  const owner: string = request.forId === '' ? '' : ` on ${className(model, request.forId)}`;
  context.commit(next, `Added note${owner}`);
  selectForEditing(context, { id, part: 'note' });
}

function newClass(model: ClassModel, item: PaletteItem, ns: string): ClassItem {
  return {
    id: uniqueClassId(model, item.prefix),
    label: '',
    generic: '',
    annotations: [...item.annotations],
    attrs: [],
    methods: [],
    css: [],
    ns,
  };
}

function classNamespace(model: ClassModel, request: AddItemRequest): string {
  if (request.connectFrom !== undefined) {
    return findClass(model, request.connectFrom)?.ns ?? '';
  }
  return request.selection.group ?? '';
}

function addedModel(model: ClassModel, added: ClassItem, request: AddItemRequest): ClassModel {
  const next: ClassModel = ops.addClass(model, added);
  if (request.connectFrom === undefined) {
    return next;
  }
  const relation: ops.NewRelation = {
    from: request.connectFrom,
    to: added.id,
    kindId: request.relationKind,
  };
  return ops.addRelation(next, relation).model;
}

function addClassItem(
  context: ClassActionContext,
  model: ClassModel,
  request: AddItemRequest & { item: PaletteItem },
): void {
  const added: ClassItem = newClass(model, request.item, classNamespace(model, request));
  const size: Size = classSize(added, canvasTextMeasurer);
  const start: Point = centeredAt(request.at, size);
  const isLinked: boolean = request.connectFrom !== undefined;
  context.positions.set(added.id, isLinked ? start : freeSpotFor(context, model, { size, start }));
  const linked: string = isLinked
    ? ` linked to ${className(model, request.connectFrom ?? '')}`
    : '';
  context.commit(
    addedModel(model, added, request),
    `Added ${request.item.name.toLowerCase()} ${added.id}${linked}`,
  );
  selectForEditing(context, { id: added.id, part: 'name' });
}

/** Adds a class, interface, abstract class, enum or note from the toolbar (click or drop). */
export function addItem(context: ClassActionContext, request: AddItemRequest): void {
  const model: ClassModel | null = context.getModel();
  const item: PaletteItem | undefined = paletteItem(request.kind);
  if (model === null || item === undefined) {
    return;
  }
  if (item.kind !== 'note') {
    addClassItem(context, model, { ...request, item });
    return;
  }
  const forId: string = noteOwner(model, request.selection);
  const ns: string = forId === '' ? (request.selection.group ?? '') : '';
  addNote(context, { forId, ns, start: noteStart(context, forId, request.at) });
}
