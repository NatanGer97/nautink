// Adding things to the state canvas (v1's StateEditor `addItem`, `addAtCenter`, `actions.addNote`,
// `actions.addState`, `actions.addRegion`): each picks a scope, a free spot and a label.
import { isHorizontalBar, placeNote } from '@nautink/editors/state/layout';
import * as ops from '@nautink/editors/state/ops';
import {
  endId,
  regionOf,
  regionScope,
  startId,
  stateById,
  uniqueId,
} from '@nautink/editors/state/scopes';
import { nodeSize } from '@nautink/editors/state/size';

import { boxOf, placeAt, stateGeometry } from './state-geometry.ts';
import { stateName } from './state-names.ts';
import { NO_SELECTION } from './state-types.ts';

import type { StateActionContext } from './state-actions.ts';
import type { Margin, StateGeometry } from './state-geometry.ts';
import type { PaletteKind, StateSelection } from './state-types.ts';
import type { Leaf } from '@nautink/editors/state/layout';
import type { LeafData } from '@nautink/editors/state/size';
import type { StateModel, StateNode, StateType } from '@nautink/editors/state/types';
import type { Point, Rect, Size } from '@nautink/visual-core/geometry';
import type { Position, PositionMap } from '@nautink/visual-core/positions';

const HALF: number = 0.5;
/** Room for a new composite's frame around its first state. */
const COMPOSITE_MARGIN: Margin = { left: 24, top: 46, right: 24, bottom: 24 };
/** New items inside a composite go just under its frame. */
const BELOW_FRAME: number = 10;
const REGION_GAP: number = 50;

const PREFIX: Readonly<Record<StateType, string>> = {
  state: 'State',
  choice: 'Choice',
  fork: 'Fork',
  join: 'Join',
};

/** Where a new item goes: its centre and its scope. */
export interface Spot {
  at: Point;
  scope: string | null;
}

function geometryOf(context: StateActionContext, model: StateModel): StateGeometry {
  return stateGeometry(model, context.positions.get());
}

/** A start or end [*] in a scope: one each per scope, kept off the code until it has a transition. */
export function addPseudo(
  context: StateActionContext,
  kind: 'start' | 'end',
  { at, scope }: Spot,
): void {
  const model: StateModel | null = context.getModel();
  if (model === null) {
    return;
  }
  const id: string = kind === 'start' ? startId(scope) : endId(scope);
  const isShown: boolean = geometryOf(context, model).leaves.some((leaf: Leaf) => leaf.id === id);
  if (!isShown) {
    const data: LeafData = { kind, isLoose: true, title: '' };
    const positions: PositionMap = context.positions.get();
    context.positions.set(id, placeAt({ model, positions, data, at, scope }));
    context.setModel(ops.addPseudo(model, id));
  }
  context.select({ ...NO_SELECTION, nodes: [id] });
}

function newData(model: StateModel, type: StateType, id: string): LeafData {
  return type === 'state'
    ? { kind: 'state', label: id, desc: [] }
    : { kind: type, isHorizontal: isHorizontalBar(model), title: '' };
}

function centered(at: Point, size: Size): Point {
  return { x: at.x - size.width * HALF, y: at.y - size.height * HALF };
}

function linked(model: StateModel, id: string, from: string): StateModel {
  const pair: { from: string; to: string } | null = ops.checkTransition(model, from, id);
  return pair === null ? model : ops.addTransition(model, pair);
}

export interface AddStateRequest extends Spot {
  type: StateType;
  /** A transition dragged from this item and dropped on empty canvas makes the new state. */
  connectFrom?: string;
}

/** A state linked from another goes where the link was dropped; any other into free space. */
function newStateSpot(
  context: StateActionContext,
  model: StateModel,
  { data, request }: { data: LeafData; request: AddStateRequest },
): Point {
  const { at, scope } = request;
  return request.connectFrom === undefined
    ? placeAt({ model, positions: context.positions.get(), data, at, scope })
    : centered(at, nodeSize(data));
}

/** The model with the new state (linked when drawn from another item) and the step label. */
function withState(model: StateModel, request: AddStateRequest, id: string): [StateModel, string] {
  const { type, scope, connectFrom } = request;
  const added: StateModel = ops.addState(model, { id, type }, scope);
  if (connectFrom === undefined) {
    return [added, `Added ${type} ${id}`];
  }
  return [
    linked(added, id, connectFrom),
    `Added ${type} ${id} after ${stateName(model, connectFrom)}`,
  ];
}

/** Adds a plain state, choice, fork or join (and selects it; a plain state opens for renaming). */
export function addState(context: StateActionContext, request: AddStateRequest): void {
  const model: StateModel | null = context.getModel();
  if (model === null) {
    return;
  }
  const id: string = uniqueId(model, PREFIX[request.type]);
  const data: LeafData = newData(model, request.type, id);
  context.positions.set(id, newStateSpot(context, model, { data, request }));
  const [next, label] = withState(model, request, id);
  context.commit(next, label);
  context.select({ ...NO_SELECTION, nodes: [id] });
  if (request.type === 'state') {
    context.setEditingId(id);
  }
}

/** Adds a composite with one state inside, and opens its title for renaming. */
export function addComposite(context: StateActionContext, { at, scope }: Spot): void {
  const model: StateModel | null = context.getModel();
  if (model === null) {
    return;
  }
  const id: string = uniqueId(model, 'Composite');
  const withComposite: StateModel = ops.addState(model, { id, isComposite: true }, scope);
  const child: string = uniqueId(withComposite, 'State');
  const data: LeafData = { kind: 'state', label: child, desc: [] };
  const positions: PositionMap = context.positions.get();
  context.positions.set(
    child,
    placeAt({ model, positions, data, at, scope, margin: COMPOSITE_MARGIN }),
  );
  context.commit(ops.addState(withComposite, { id: child }, id), `Added composite ${id}`);
  context.select({ ...NO_SELECTION, group: id });
  context.setEditingId(id);
}

/** Adds a note on a state, beside it, and opens it for editing. */
export function addNoteOn(context: StateActionContext, target: string): void {
  const model: StateModel | null = context.getModel();
  if (model === null || stateById(model, target) === undefined) {
    return;
  }
  const count: number = model.notes.filter((note) => note.target === target).length;
  const next: StateModel = ops.addNote(model, { target, side: 'right', text: 'Note' });
  const id: string = `note:${target}:${String(count)}`;
  context.positions.replace(placeNote(next, context.positions.get(), id));
  context.commit(next, `Added note on ${stateName(model, target)}`);
  context.select({ ...NO_SELECTION, nodes: [id] });
  context.setEditingId(id);
}

/** The state nearest to a point (a dropped note attaches to it). */
export function nearestState(model: StateModel, geometry: StateGeometry, at: Point): string | null {
  let best: { id: string; distance: number } | null = null;
  for (const [id, box] of Object.entries(geometry.boxes)) {
    const distance: number = Math.hypot(box.x + box.w * HALF - at.x, box.y + box.h * HALF - at.y);
    if (stateById(model, id) !== undefined && (best === null || distance < best.distance)) {
      best = { id, distance };
    }
  }
  return best?.id ?? null;
}

/** The selected state a toolbar note goes on: one selected state, or the selected composite. */
function selectedState(model: StateModel, selection: StateSelection): string | null {
  const states: string[] = selection.nodes.filter((id: string) => stateById(model, id));
  const [only] = states;
  if (states.length === 1 && only !== undefined) {
    return only;
  }
  return selection.group;
}

export interface AddRequest {
  kind: PaletteKind;
  spot: Spot;
  selection: StateSelection;
  /** Dropped on the canvas: a note goes on the nearest state, not the selected one. */
  isDropped: boolean;
}

/** A toolbar note goes on the selected state; a dropped one on the state nearest the drop. */
function addNoteAt(context: StateActionContext, model: StateModel, request: AddRequest): void {
  const target: string | null =
    (request.isDropped ? null : selectedState(model, request.selection)) ??
    nearestState(model, geometryOf(context, model), request.spot.at);
  if (target !== null) {
    addNoteOn(context, target);
  }
}

/** Adds one toolbar item (clicked or dropped). */
export function addItem(context: StateActionContext, request: AddRequest): void {
  const model: StateModel | null = context.getModel();
  const { kind, spot } = request;
  if (model === null) {
    return;
  }
  if (kind === 'start' || kind === 'end') {
    addPseudo(context, kind, spot);
  } else if (kind === 'composite') {
    addComposite(context, spot);
  } else if (kind === 'note') {
    addNoteAt(context, model, request);
  } else {
    addState(context, { type: kind, ...spot });
  }
}

function scopeBox(model: StateModel, geometry: StateGeometry, scope: string): Rect | undefined {
  return boxOf(geometry, scope) ?? boxOf(geometry, regionOf(model, scope)?.id ?? '');
}

/** Just under a scope's frame, where "Add state inside" puts the new state. */
export function belowScope(context: StateActionContext, model: StateModel, scope: string): Point {
  const box: Rect | undefined = scopeBox(model, geometryOf(context, model), scope);
  return box === undefined
    ? { x: 0, y: 0 }
    : { x: box.x + box.w * HALF, y: box.y + box.h + BELOW_FRAME };
}

/**
 * Where a toolbar click adds: inside the selected composite (its first region, if any), else at
 * the middle of the view at the top level (v1's `addAtCenter`).
 */
export function toolbarSpot(
  context: StateActionContext,
  selection: StateSelection,
  center: Point,
): Spot {
  const model: StateModel | null = context.getModel();
  const group: string | null = selection.group;
  const composite: StateNode | undefined =
    model === null || group === null ? undefined : stateById(model, group);
  if (model === null || composite === undefined) {
    return { at: center, scope: null };
  }
  const scope: string = composite.regions > 0 ? regionScope(composite.id, 0) : composite.id;
  return { at: belowScope(context, model, composite.id), scope };
}

/** Adds a plain state inside a scope (the inspector's "Add state inside"). */
export function addStateInside(context: StateActionContext, scope: string): void {
  const model: StateModel | null = context.getModel();
  if (model !== null) {
    addState(context, { type: 'state', at: belowScope(context, model, scope), scope });
  }
}

/** Adds a concurrent region holding a new state; a plain composite's [*] move to region 1. */
export function addRegion(context: StateActionContext, id: string): void {
  const model: StateModel | null = context.getModel();
  const composite: StateNode | undefined = model === null ? undefined : stateById(model, id);
  if (model === null || composite === undefined) {
    return;
  }
  const child: string = uniqueId(model, 'State');
  const box: Rect | undefined = boxOf(geometryOf(context, model), id);
  const at: Point =
    box === undefined ? { x: 0, y: 0 } : { x: box.x + box.w * HALF, y: box.y + box.h + REGION_GAP };
  const positions: PositionMap = context.positions.get();
  const data: LeafData = { kind: 'state', label: child, desc: [] };
  context.positions.set(child, placeAt({ model, positions, data, at, scope: id }));
  if (composite.regions === 0) {
    context.positions.replace(movedToFirstRegion(context.positions.get(), id));
  }
  context.commit(ops.addRegion(model, id, child), `Added region to ${stateName(model, id)}`);
}

function movedToFirstRegion(positions: PositionMap, id: string): PositionMap {
  const first: string = regionScope(id, 0);
  const moves: [string, string][] = [
    [startId(id), startId(first)],
    [endId(id), endId(first)],
  ];
  const moved: PositionMap = { ...positions };
  for (const [from, to] of moves) {
    const position: Position | undefined = Object.hasOwn(positions, from)
      ? positions[from]
      : undefined;
    if (position !== undefined) {
      moved[to] = position;
    }
  }
  return moved;
}
