// The class canvas selection: what React Flow's change events do to it, what survives an outside
// change, and what the app-wide selection store hears about it.
import { allNamespaces, canvasItems, lolliId } from '@nautink/editors/class/layout';
import { readable } from '@nautink/editors/class/text';

import { className, itemKind, relationName } from './class-names.ts';
import { FRAME_PREFIX, NO_SELECTION, NOTE_LINK_PREFIX } from './class-types.ts';
import { canvasTextMeasurer } from '../canvas/text-measurer.ts';

import type { ClassSelection } from './class-types.ts';
import type { SelectedItem } from '../selection/canvas-selection.ts';
import type { ClassModel, ClassRelation } from '@nautink/editors/class/types';
import type { EdgeChange, NodeChange } from '@xyflow/react';

const NOTE_LABEL_CLIP: number = 40;

function withId(list: readonly string[], id: string, isIn: boolean): string[] {
  const without: string[] = list.filter((item) => item !== id);
  return isIn ? [...without, id] : without;
}

function frameSelect(selection: ClassSelection, ns: string, isSelected: boolean): ClassSelection {
  if (isSelected) {
    return { ...selection, group: ns };
  }
  return selection.group === ns ? { ...selection, group: null } : selection;
}

/** Applies React Flow's node select changes; a frame selects its namespace. */
export function applyNodeSelection(
  changes: readonly NodeChange[],
  selection: ClassSelection,
): ClassSelection {
  return changes.reduce((next: ClassSelection, change: NodeChange): ClassSelection => {
    if (change.type !== 'select') {
      return next;
    }
    return change.id.startsWith(FRAME_PREFIX)
      ? frameSelect(next, change.id.slice(FRAME_PREFIX.length), change.selected)
      : { ...next, nodes: withId(next.nodes, change.id, change.selected) };
  }, selection);
}

/** Applies React Flow's edge select changes. Note links cannot be selected. */
export function applyEdgeSelection(
  changes: readonly EdgeChange[],
  selection: ClassSelection,
): ClassSelection {
  return changes.reduce(
    (next: ClassSelection, change: EdgeChange) =>
      change.type === 'select' && !change.id.startsWith(NOTE_LINK_PREFIX)
        ? { ...next, edges: withId(next.edges, change.id, change.selected) }
        : next,
    selection,
  );
}

/** Drops ids an outside change removed (an undo, Claude, typing). */
export function liveSelection(selection: ClassSelection, model: ClassModel | null): ClassSelection {
  if (model === null) {
    return NO_SELECTION;
  }
  const items: Set<string> = new Set<string>(
    canvasItems(model, canvasTextMeasurer).map((item) => item.id),
  );
  const relations: Set<string> = new Set<string>(model.relations.map((relation) => relation.id));
  const isLiveGroup: boolean =
    selection.group !== null && allNamespaces(model).includes(selection.group);
  return {
    nodes: selection.nodes.filter((id) => items.has(id)),
    edges: selection.edges.filter((id) => relations.has(id)),
    group: isLiveGroup ? selection.group : null,
  };
}

/** The selection for Mermaid ids picked elsewhere (a click in Split's preview half). */
export function selectionOfIds(model: ClassModel | null, ids: readonly string[]): ClassSelection {
  if (model === null) {
    return NO_SELECTION;
  }
  const group: string | undefined = allNamespaces(model).find((ns) => ids.includes(ns));
  return liveSelection({ nodes: [...ids], edges: [...ids], group: group ?? null }, model);
}

function lollipopOf(model: ClassModel, id: string): ClassRelation | undefined {
  return model.relations.find((relation) => lolliId(relation) === id);
}

function nodeItem(model: ClassModel, id: string): SelectedItem {
  const kind: 'class' | 'note' | 'lolli' | null = itemKind(model, id);
  if (kind === 'class') {
    return { id, label: className(model, id), kind: 'class' };
  }
  if (kind === 'note') {
    const text: string = readable(model.notes.find((note) => note.id === id)?.text ?? '');
    return { id, label: text.slice(0, NOTE_LABEL_CLIP), kind: 'note' };
  }
  const relation: ClassRelation | undefined = lollipopOf(model, id);
  const label: string = relation?.t1 === 'lolli' ? relation.from : (relation?.to ?? id);
  return { id, label, kind: 'interface' };
}

/** The selection as the app-wide store keeps it (ids, labels, kinds), for prompts and Split. */
export function selectedItems(model: ClassModel | null, selection: ClassSelection): SelectedItem[] {
  if (model === null) {
    return [];
  }
  return [
    ...selection.nodes.map((id) => nodeItem(model, id)),
    ...selection.edges.map((id) => ({ id, label: relationName(model, id), kind: 'relation' })),
    ...(selection.group === null
      ? []
      : [{ id: selection.group, label: selection.group, kind: 'namespace' }]),
  ];
}
