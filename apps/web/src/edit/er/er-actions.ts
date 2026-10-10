// Every ER edit as a labelled undo step (v1's EREditor `actions`, `addEntity`, `onConnect`,
// `onDelete`). Pure of React: each action reads the newest model and positions when it runs.
import { dagreLayout, freeSpot } from '@nautink/editors/er/layout';
import { cleanName, uniqueName } from '@nautink/editors/er/model';
import * as ops from '@nautink/editors/er/ops';
import { parentMap } from '@nautink/editors/shared/subgraphs';
import { deleteLabel, editLabel } from '@nautink/visual-core/labels';
import { clip } from '@nautink/visual-core/text';

import { entityBox } from './er-layout.ts';
import { entityName, groupName, relName } from './er-names.ts';
import { NO_SELECTION } from './er-types.ts';
import { canvasTextMeasurer } from '../canvas/text-measurer.ts';

import type { ErCanvasSelection } from './er-types.ts';
import type {
  ErAttribute,
  ErDirection,
  ErEntity,
  ErKey,
  ErModel,
  ErRelationship,
  ErSubgraph,
} from '@nautink/editors/er/model';
import type { AttributeRef } from '@nautink/editors/er/ops';
import type { Point } from '@nautink/visual-core/geometry';
import type { PositionMap } from '@nautink/visual-core/positions';

export interface ErActionContext {
  getModel: () => ErModel | null;
  commit: (next: ErModel, label: string) => void;
  positions: {
    get: () => PositionMap;
    set: (id: string, point: Point) => void;
    replace: (positions: PositionMap) => void;
  };
  select: (selection: ErCanvasSelection) => void;
  setEditingId: (id: string | null) => void;
  requestFit: () => void;
}

const NAME_CLIP: number = 28;
const HALF: number = 0.5;

type Edit = (model: ErModel) => [ErModel, string];

/** Runs one edit on the newest model and commits it with its label. */
function run(context: ErActionContext, edit: Edit): void {
  const model: ErModel | null = context.getModel();
  if (model !== null) {
    const [next, label] = edit(model);
    context.commit(next, label);
  }
}

/** A new entity starts with an `int id PK` attribute (v1). */
export function newEntity(name: string): ErEntity {
  return {
    name,
    alias: '',
    attributes: [{ type: 'int', name: 'id', keys: ['PK'], comment: '' }],
    classes: [],
  };
}

export interface AddEntityRequest {
  /** Where the entity should go, in canvas coordinates: its centre, or its top edge for a link. */
  at: Point;
  /** A link drawn from this entity (or group) and dropped on empty canvas makes the new entity. */
  connectFrom?: string;
}

/** Where a new entity goes: centred on the point in free space, or under a dropped link's end. */
function spotFor(
  model: ErModel,
  entity: ErEntity,
  request: AddEntityRequest & { positions: PositionMap },
): Point {
  const { width, height } = entityBox(entity);
  if (request.connectFrom !== undefined) {
    return { x: Math.round(request.at.x - width * HALF), y: Math.round(request.at.y) };
  }
  const start: Point = { x: request.at.x - width * HALF, y: request.at.y - height * HALF };
  const size: { width: number; height: number } = { width, height };
  return freeSpot({
    model,
    measure: canvasTextMeasurer,
    positions: request.positions,
    size,
    start,
  });
}

function addedModel(model: ErModel, entity: ErEntity, connectFrom: string | undefined): ErModel {
  if (connectFrom === undefined) {
    return ops.addEntity(model, entity);
  }
  const group: string | null = parentMap(model.subgraphs).get(connectFrom) ?? null;
  return ops.addRel(ops.addEntity(model, entity, group), { from: connectFrom, to: entity.name })
    .model;
}

function addedLabel(model: ErModel, entity: ErEntity, request: AddEntityRequest): string {
  const from: string | undefined = request.connectFrom;
  return `Added entity ${entity.name}${from === undefined ? '' : ` related to ${entityName(model, from)}`}`;
}

/** Adds an entity (and selects it for renaming), in free space unless a link placed it. */
export function addEntity(context: ErActionContext, request: AddEntityRequest): void {
  const model: ErModel | null = context.getModel();
  if (model === null) {
    return;
  }
  const entity: ErEntity = newEntity(uniqueName(model));
  context.positions.set(
    entity.name,
    spotFor(model, entity, { ...request, positions: context.positions.get() }),
  );
  context.commit(
    addedModel(model, entity, request.connectFrom),
    addedLabel(model, entity, request),
  );
  context.select({ ...NO_SELECTION, entities: [entity.name] });
  context.setEditingId(entity.name);
}

function movePosition(positions: PositionMap, from: string, to: string): PositionMap {
  if (!Object.hasOwn(positions, from)) {
    return positions;
  }
  const { [from]: spot, ...rest } = positions;
  return spot === undefined ? rest : { ...rest, [to]: spot };
}

/** Renames an entity everywhere, keeping its spot and selection. False when the name is invalid or taken. */
export function renameEntity(context: ErActionContext, from: string, to: string): boolean {
  const model: ErModel | null = context.getModel();
  const next: ErModel | null = model === null ? null : ops.renameEntity(model, from, to);
  if (next === null) {
    return false;
  }
  const name: string = cleanName(to);
  context.positions.replace(movePosition(context.positions.get(), from, name));
  context.commit(next, `Renamed ${clip(from, NAME_CLIP)} → ${clip(name, NAME_CLIP)}`);
  context.select({ ...NO_SELECTION, entities: [name] });
  return true;
}

export function updateEntity(
  context: ErActionContext,
  name: string,
  patch: Partial<ErEntity>,
): void {
  run(context, (m) => [
    ops.updateEntity(m, name, patch),
    editLabel('entity', entityName(m, name), patch),
  ]);
}

/** The header's inline rename: it edits the alias when there is one, the name otherwise (v1). */
export function renameFromHeader(context: ErActionContext, name: string, text: string): void {
  const entity: ErEntity | undefined = context
    .getModel()
    ?.entities.find((item) => item.name === name);
  const trimmed: string = text.trim();
  if (entity === undefined || trimmed === '' || trimmed === (entity.alias || entity.name)) {
    return;
  }
  if (entity.alias === '') {
    renameEntity(context, name, trimmed);
    return;
  }
  run(context, (m) => [
    ops.updateEntity(m, name, { alias: trimmed }),
    `Renamed ${clip(entity.alias, NAME_CLIP)} → ${clip(trimmed, NAME_CLIP)}`,
  ]);
}

export function addAttribute(context: ErActionContext, name: string): void {
  run(context, (m) => [ops.addAttribute(m, name), `Added attribute to ${entityName(m, name)}`]);
}

export function updateAttribute(
  context: ErActionContext,
  ref: AttributeRef & { patch: Partial<ErAttribute> },
): void {
  run(context, (m) => [
    ops.updateAttribute(m, ref),
    `Edited attribute of ${entityName(m, ref.entityName)}`,
  ]);
}

export function toggleKey(context: ErActionContext, ref: AttributeRef & { key: ErKey }): void {
  run(context, (m) => [
    ops.toggleKey(m, ref),
    `Toggled ${ref.key} in ${entityName(m, ref.entityName)}`,
  ]);
}

export function removeAttribute(
  context: ErActionContext,
  { entityName: name, index }: AttributeRef,
): void {
  run(context, (m) => [
    ops.removeAttribute(m, name, index),
    `Removed attribute from ${entityName(m, name)}`,
  ]);
}

export function moveAttribute(
  context: ErActionContext,
  ref: AttributeRef & { delta: number },
): void {
  run(context, (m) => [
    ops.moveAttribute(m, ref),
    `Reordered attributes of ${entityName(m, ref.entityName)}`,
  ]);
}

export function setEntityGroup(
  context: ErActionContext,
  name: string,
  groupId: string | null,
): void {
  run(context, (m) => [
    ops.setEntityGroup(m, name, groupId),
    groupId === null
      ? `Moved ${entityName(m, name)} out of its group`
      : `Moved ${entityName(m, name)} into ${groupName(m, groupId)}`,
  ]);
}

export function updateRel(
  context: ErActionContext,
  id: string,
  patch: Partial<ErRelationship>,
): void {
  run(context, (m) => [
    ops.updateRel(m, id, patch),
    editLabel('relationship', relName(m, id), patch),
  ]);
}

/** The inline label editor on a link; nothing is recorded when the label did not change. */
export function setRelLabel(context: ErActionContext, id: string, label: string): void {
  const rel: ErRelationship | undefined = context.getModel()?.rels.find((item) => item.id === id);
  if (rel !== undefined && rel.label !== label) {
    updateRel(context, id, { label });
  }
}

/** Swaps the ends of a relationship and keeps it selected under its new id. */
export function reverseRel(context: ErActionContext, id: string): void {
  const model: ErModel | null = context.getModel();
  if (model === null) {
    return;
  }
  const { model: next, id: newId } = ops.reverseRel(model, id);
  context.commit(next, `Reversed relationship ${relName(model, id)}`);
  context.select({ ...NO_SELECTION, rels: [newId] });
}

export function updateGroup(
  context: ErActionContext,
  id: string,
  patch: Partial<ErSubgraph>,
): void {
  run(context, (m) => [ops.updateGroup(m, id, patch), editLabel('group', groupName(m, id), patch)]);
}

export function ungroup(context: ErActionContext, id: string): void {
  run(context, (m) => [ops.ungroup(m, id), `Ungrouped ${groupName(m, id)}`]);
  context.select(NO_SELECTION);
}

/** Relates two entities (dragged from a handle onto another) and selects the new relationship. */
export function connect(context: ErActionContext, from: string, to: string): void {
  const model: ErModel | null = context.getModel();
  if (model === null) {
    return;
  }
  const { model: next, id } = ops.addRel(model, { from, to });
  context.commit(next, `Connected ${entityName(model, from)} → ${entityName(model, to)}`);
  context.select({ ...NO_SELECTION, rels: [id] });
}

/** The names a delete step lists: relationships that go with their entities are not counted (v1). */
export function deletedNames(model: ErModel, selection: ErCanvasSelection): string[] {
  const entities: Set<string> = new Set<string>(selection.entities);
  const ownRels: string[] = selection.rels.filter((id) => {
    const rel: ErRelationship | undefined = model.rels.find((item) => item.id === id);
    return rel !== undefined && !entities.has(rel.from) && !entities.has(rel.to);
  });
  return [
    ...selection.entities.map((name) => entityName(model, name)),
    ...ownRels.map((id) => `relationship ${relName(model, id)}`),
    ...(selection.group === null ? [] : [groupName(model, selection.group)]),
  ];
}

/** Deletes the selection: entities with their relationships, relationships, and a group. */
export function deleteSelection(context: ErActionContext, selection: ErCanvasSelection): void {
  const isEmpty: boolean =
    selection.entities.length === 0 && selection.rels.length === 0 && selection.group === null;
  if (isEmpty) {
    return;
  }
  run(context, (m) => [
    ops.deleteItems(m, {
      entityNames: selection.entities,
      relIds: selection.rels,
      groupIds: selection.group === null ? [] : [selection.group],
    }),
    deleteLabel(deletedNames(m, selection)),
  ]);
  context.select(NO_SELECTION);
}

/** Changes the diagram's direction and lays it out again in it (v1). */
export function setDirection(context: ErActionContext, direction: ErDirection): void {
  const model: ErModel | null = context.getModel();
  if (model === null || model.direction === direction) {
    return;
  }
  const next: ErModel = { ...model, direction };
  context.positions.replace({
    ...context.positions.get(),
    ...dagreLayout(next, canvasTextMeasurer),
  });
  context.commit(next, `Changed direction to ${direction}`);
  context.requestFit();
}
