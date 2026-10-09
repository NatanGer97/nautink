// The flowchart selection: what React Flow's change events do to it, what survives an outside
// change, and what the app-wide selection store hears about it.
import { edgeName, nodeName } from './flow-names.ts';
import { NO_SELECTION } from './flow-types.ts';

import type { FlowSelection } from './flow-types.ts';
import type { SelectedItem } from '../selection/canvas-selection.ts';
import type { FlowGraph } from '@nautink/editors/flow/model';
import type { EdgeChange, NodeChange, XYPosition } from '@xyflow/react';

function withId(list: readonly string[], id: string, isIn: boolean): string[] {
  const without: string[] = list.filter((item) => item !== id);
  return isIn ? [...without, id] : without;
}

/** Applies React Flow's node select changes. Removals go through `onDelete` instead. */
export function applyNodeSelection(
  changes: readonly NodeChange[],
  selection: FlowSelection,
  groupIds: ReadonlySet<string>,
): FlowSelection {
  return changes.reduce((next: FlowSelection, change: NodeChange): FlowSelection => {
    if (change.type !== 'select') {
      return next;
    }
    return groupIds.has(change.id)
      ? groupSelect(next, change.id, change.selected)
      : { ...next, nodes: withId(next.nodes, change.id, change.selected) };
  }, selection);
}

function groupSelect(selection: FlowSelection, id: string, isSelected: boolean): FlowSelection {
  if (isSelected) {
    return { ...selection, group: id };
  }
  return selection.group === id ? { ...selection, group: null } : selection;
}

/** The node moves in a batch of changes (a drag, a keyboard nudge). Group frames never move. */
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
export function applyEdgeChanges(
  changes: readonly EdgeChange[],
  selection: FlowSelection,
): FlowSelection {
  return changes.reduce(
    (next: FlowSelection, change: EdgeChange) =>
      change.type === 'select'
        ? { ...next, edges: withId(next.edges, change.id, change.selected) }
        : next,
    selection,
  );
}

/** Drops ids an outside change removed (an undo, Claude, typing). */
export function liveSelection(selection: FlowSelection, graph: FlowGraph | null): FlowSelection {
  if (graph === null) {
    return NO_SELECTION;
  }
  const nodes: Set<string> = new Set<string>(graph.nodes.map((node) => node.id));
  const edges: Set<string> = new Set<string>(graph.edges.map((edge) => edge.id));
  const groups: Set<string> = new Set<string>(graph.subgraphs.map((group) => group.id));
  return {
    nodes: selection.nodes.filter((id) => nodes.has(id) && !groups.has(id)),
    edges: selection.edges.filter((id) => edges.has(id)),
    group: selection.group !== null && groups.has(selection.group) ? selection.group : null,
  };
}

/** The selection for Mermaid ids picked elsewhere (a click in Split's preview half). */
export function selectionOfIds(graph: FlowGraph | null, ids: readonly string[]): FlowSelection {
  if (graph === null) {
    return NO_SELECTION;
  }
  const group: string | undefined = graph.subgraphs.find((item) => ids.includes(item.id))?.id;
  return liveSelection(
    { nodes: [...ids], edges: ids.filter((id) => id.startsWith('L_')), group: group ?? null },
    graph,
  );
}

/** The selection as the app-wide store keeps it (ids, labels, kinds), for prompts and Split. */
export function selectedItems(graph: FlowGraph | null, selection: FlowSelection): SelectedItem[] {
  if (graph === null) {
    return [];
  }
  return [
    ...selection.nodes.map((id) => ({ id, label: nodeName(graph, id), kind: 'node' })),
    ...selection.edges.map((id) => ({ id, label: edgeName(graph, id), kind: 'link' })),
    ...(selection.group === null
      ? []
      : [{ id: selection.group, label: nodeName(graph, selection.group), kind: 'group' }]),
  ];
}
