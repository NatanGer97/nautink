// The ER selection: what React Flow's change events do to it, what survives an outside change, and
// what the app-wide selection store hears about it.
import { entityName, groupName, relName } from './er-names.ts';
import { NO_SELECTION } from './er-types.ts';

import type { ErCanvasSelection } from './er-types.ts';
import type { SelectedItem } from '../selection/canvas-selection.ts';
import type { ErModel } from '@nautink/editors/er/model';
import type { EdgeChange, NodeChange, XYPosition } from '@xyflow/react';

function withId(list: readonly string[], id: string, isIn: boolean): string[] {
  const without: string[] = list.filter((item) => item !== id);
  return isIn ? [...without, id] : without;
}

function groupSelect(
  selection: ErCanvasSelection,
  id: string,
  isSelected: boolean,
): ErCanvasSelection {
  if (isSelected) {
    return { ...selection, group: id };
  }
  return selection.group === id ? { ...selection, group: null } : selection;
}

/** Applies React Flow's node select changes. Removals go through `onDelete` instead. */
export function applyNodeSelection(
  changes: readonly NodeChange[],
  selection: ErCanvasSelection,
  groupIds: ReadonlySet<string>,
): ErCanvasSelection {
  return changes.reduce((next: ErCanvasSelection, change: NodeChange): ErCanvasSelection => {
    if (change.type !== 'select') {
      return next;
    }
    return groupIds.has(change.id)
      ? groupSelect(next, change.id, change.selected)
      : { ...next, entities: withId(next.entities, change.id, change.selected) };
  }, selection);
}

/** The entity moves in a batch of changes (a drag). Group frames never move. */
export function nodeMoves(
  changes: readonly NodeChange[],
  groupIds: ReadonlySet<string>,
): [string, XYPosition][] {
  return changes.flatMap((change: NodeChange): [string, XYPosition][] =>
    change.type === 'position' && change.position !== undefined && !groupIds.has(change.id)
      ? [[change.id, change.position]]
      : [],
  );
}

/** Applies React Flow's edge select changes. */
export function applyEdgeSelection(
  changes: readonly EdgeChange[],
  selection: ErCanvasSelection,
): ErCanvasSelection {
  return changes.reduce(
    (next: ErCanvasSelection, change: EdgeChange) =>
      change.type === 'select'
        ? { ...next, rels: withId(next.rels, change.id, change.selected) }
        : next,
    selection,
  );
}

/** Drops names an outside change removed (an undo, Claude, typing). */
export function liveSelection(
  selection: ErCanvasSelection,
  model: ErModel | null,
): ErCanvasSelection {
  if (model === null) {
    return NO_SELECTION;
  }
  const entities: Set<string> = new Set<string>(model.entities.map((entity) => entity.name));
  const rels: Set<string> = new Set<string>(model.rels.map((rel) => rel.id));
  const groups: Set<string> = new Set<string>(model.subgraphs.map((group) => group.id));
  return {
    entities: selection.entities.filter((name) => entities.has(name)),
    rels: selection.rels.filter((id) => rels.has(id)),
    group: selection.group !== null && groups.has(selection.group) ? selection.group : null,
  };
}

/** The selection for Mermaid ids picked elsewhere (a click in Split's preview half). */
export function selectionOfIds(model: ErModel | null, ids: readonly string[]): ErCanvasSelection {
  if (model === null) {
    return NO_SELECTION;
  }
  const group: string | undefined = model.subgraphs.find((item) => ids.includes(item.id))?.id;
  return liveSelection({ entities: [...ids], rels: [...ids], group: group ?? null }, model);
}

/** The selection as the app-wide store keeps it (ids, labels, kinds), for prompts and Split. */
export function selectedItems(model: ErModel | null, selection: ErCanvasSelection): SelectedItem[] {
  if (model === null) {
    return [];
  }
  return [
    ...selection.entities.map((id) => ({ id, label: entityName(model, id), kind: 'entity' })),
    ...selection.rels.map((id) => ({ id, label: relName(model, id), kind: 'relationship' })),
    ...(selection.group === null
      ? []
      : [{ id: selection.group, label: groupName(model, selection.group), kind: 'group' }]),
  ];
}
