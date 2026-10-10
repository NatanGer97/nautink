// The state selection: what React Flow's change events do to it, what survives an outside change,
// and what the app-wide selection store hears about it (Mermaid ids, for Split and prompts).
import { leaves } from '@nautink/editors/state/layout';
import { displayName, pseudoOf, scopeLabel, stateById } from '@nautink/editors/state/scopes';
import { clip } from '@nautink/visual-core/text';

import { transitionName } from './state-names.ts';
import { NO_SELECTION } from './state-types.ts';

import type { StateSelection } from './state-types.ts';
import type { SelectedItem } from '../selection/canvas-selection.ts';
import type { Leaf } from '@nautink/editors/state/layout';
import type { Pseudo, StateModel, StateNode, StateNote } from '@nautink/editors/state/types';
import type { EdgeChange, NodeChange } from '@xyflow/react';

const NOTE_CLIP: number = 28;

function withId(list: readonly string[], id: string, isIn: boolean): string[] {
  const without: string[] = list.filter((item: string) => item !== id);
  return isIn ? [...without, id] : without;
}

function frameSelect(selection: StateSelection, id: string, isSelected: boolean): StateSelection {
  if (isSelected) {
    return { ...selection, group: id };
  }
  return selection.group === id ? { ...selection, group: null } : selection;
}

function leafSelect(selection: StateSelection, id: string, isSelected: boolean): StateSelection {
  const group: string | null = !isSelected && selection.group === id ? null : selection.group;
  return { ...selection, nodes: withId(selection.nodes, id, isSelected), group };
}

/** Applies React Flow's node select changes. Removals go through `onDelete` instead. */
export function applyNodeSelection(
  changes: readonly NodeChange[],
  selection: StateSelection,
  frameIds: ReadonlySet<string>,
): StateSelection {
  return changes.reduce((next: StateSelection, change: NodeChange): StateSelection => {
    if (change.type !== 'select') {
      return next;
    }
    return frameIds.has(change.id)
      ? frameSelect(next, change.id, change.selected)
      : leafSelect(next, change.id, change.selected);
  }, selection);
}

/** Applies React Flow's edge select changes; note links cannot be selected. */
export function applyEdgeSelection(
  changes: readonly EdgeChange[],
  selection: StateSelection,
): StateSelection {
  return changes.reduce(
    (next: StateSelection, change: EdgeChange) =>
      change.type === 'select'
        ? { ...next, edges: withId(next.edges, change.id, change.selected) }
        : next,
    selection,
  );
}

/** Drops ids an outside change removed (an undo, Claude, typing). */
export function liveSelection(selection: StateSelection, model: StateModel | null): StateSelection {
  if (model === null) {
    return NO_SELECTION;
  }
  const leafIds: Set<string> = new Set<string>(leaves(model).list.map((leaf: Leaf) => leaf.id));
  const edgeIds: Set<string> = new Set<string>(model.transitions.map((item) => item.id));
  const group: string | null = selection.group;
  const isGroupLive: boolean = group !== null && stateById(model, group)?.isComposite === true;
  return {
    nodes: selection.nodes.filter((id: string) => leafIds.has(id)),
    edges: selection.edges.filter((id: string) => edgeIds.has(id)),
    group: isGroupLive ? group : null,
  };
}

/** The selection for ids picked elsewhere: Mermaid ids from Split's preview half, or transition ids. */
export function selectionOfIds(model: StateModel | null, ids: readonly string[]): StateSelection {
  if (model === null) {
    return NO_SELECTION;
  }
  const leafIds: Set<string> = new Set<string>(leaves(model).list.map((leaf: Leaf) => leaf.id));
  const group: string | undefined = ids.find(
    (id: string) => stateById(model, id)?.isComposite === true && !leafIds.has(id),
  );
  return {
    nodes: ids.filter((id: string) => leafIds.has(id)),
    edges: ids.filter((id: string) => model.transitions.some((item) => item.id === id)),
    group: group ?? null,
  };
}

function pseudoItem(model: StateModel, pseudo: Pseudo): SelectedItem {
  const name: string = pseudo.kind === 'start' ? 'Start' : 'End';
  const where: string = pseudo.scope === null ? '' : ` in ${scopeLabel(model, pseudo.scope)}`;
  return { id: '[*]', label: `${name}${where}`, kind: 'state' };
}

/** One selected leaf as the store keeps it: a state by id, `[*]` for start or end, or a note. */
function leafItem(model: StateModel, id: string): SelectedItem {
  const pseudo: Pseudo | null = pseudoOf(id);
  if (pseudo) {
    return pseudoItem(model, pseudo);
  }
  const note: StateNote | undefined = model.notes.find((item: StateNote) => item.id === id);
  if (note !== undefined) {
    return { id: note.target, label: `Note: ${clip(note.text, NOTE_CLIP)}`, kind: 'note' };
  }
  const state: StateNode | undefined = stateById(model, id);
  return { id, label: state ? displayName(state) : id, kind: 'state' };
}

/** The selection as the app-wide store keeps it (ids, labels, kinds), for prompts and Split. */
export function selectedItems(model: StateModel | null, selection: StateSelection): SelectedItem[] {
  if (model === null) {
    return [];
  }
  return [
    ...selection.nodes.map((id: string) => leafItem(model, id)),
    ...(selection.group === null ? [] : [leafItem(model, selection.group)]),
    ...selection.edges.map((id: string) => ({
      id,
      label: transitionName(model, id),
      kind: 'transition',
    })),
  ];
}
