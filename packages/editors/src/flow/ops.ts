// Pure graph edits. Each returns a new graph.
import { uniqueId } from './model.ts';
import { parentMap } from '../shared/subgraphs.ts';

import type { FlowEdge, FlowGraph, FlowNode, FlowSubgraph } from './model.ts';

/** A node to add; `classes` defaults to none. */
export type NewFlowNode = Omit<FlowNode, 'classes'> & { classes?: string[] };

/** An edge to add: its ends, plus any field to override the defaults. */
export type NewFlowEdge = Pick<FlowEdge, 'source' | 'target'> & Partial<FlowEdge>;

/** Items to delete together. */
export interface FlowSelection {
  nodeIds?: readonly string[];
  edgeIds?: readonly string[];
  groupIds?: readonly string[];
}

function withoutMembers(
  subgraphs: readonly FlowSubgraph[],
  ids: ReadonlySet<string>,
): FlowSubgraph[] {
  return subgraphs.map((subgraph: FlowSubgraph) => ({
    ...subgraph,
    members: subgraph.members.filter((member: string) => !ids.has(member)),
  }));
}

function addMember(
  subgraphs: readonly FlowSubgraph[],
  groupId: string | null | undefined,
  id: string,
): FlowSubgraph[] {
  return subgraphs.map((subgraph: FlowSubgraph) =>
    subgraph.id === groupId ? { ...subgraph, members: [...subgraph.members, id] } : subgraph,
  );
}

/** Adds a node, inside a subgraph when `groupId` is given. */
export function addNode(
  graph: FlowGraph,
  node: NewFlowNode,
  groupId: string | null = null,
): FlowGraph {
  const subgraphs: FlowSubgraph[] = groupId
    ? addMember(graph.subgraphs, groupId, node.id)
    : graph.subgraphs;
  return { ...graph, nodes: [...graph.nodes, { classes: [], ...node }], subgraphs };
}

export function updateNode(graph: FlowGraph, id: string, patch: Partial<FlowNode>): FlowGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node: FlowNode) => (node.id === id ? { ...node, ...patch } : node)),
  };
}

/** Adds a solid arrow (unless `edge` says otherwise) with the next free id for its ends. */
export function addEdge(graph: FlowGraph, edge: NewFlowEdge): FlowGraph {
  const key: string = `${edge.source}_${edge.target}`;
  let index: number = 0;
  while (graph.edges.some((existing: FlowEdge) => existing.id === `L_${key}_${String(index)}`)) {
    index++;
  }
  const added: FlowEdge = {
    id: `L_${key}_${String(index)}`,
    label: '',
    arrow: 'point',
    stroke: 'normal',
    ...edge,
  };
  return { ...graph, edges: [...graph.edges, added] };
}

export function updateEdge(graph: FlowGraph, id: string, patch: Partial<FlowEdge>): FlowGraph {
  return {
    ...graph,
    edges: graph.edges.map((edge: FlowEdge) => (edge.id === id ? { ...edge, ...patch } : edge)),
  };
}

export function reverseEdge(graph: FlowGraph, id: string): FlowGraph {
  return {
    ...graph,
    edges: graph.edges.map((edge: FlowEdge) =>
      edge.id === id ? { ...edge, source: edge.target, target: edge.source } : edge,
    ),
  };
}

// Drops `group` from every subgraph and hands its members to `parent`.
function liftMembers(
  graph: FlowGraph,
  group: FlowSubgraph,
  parent: string | undefined,
): FlowSubgraph[] {
  return graph.subgraphs
    .filter((subgraph: FlowSubgraph) => subgraph.id !== group.id)
    .map((subgraph: FlowSubgraph) => {
      const members: string[] = subgraph.members.filter((member: string) => member !== group.id);
      const lifted: string[] =
        subgraph.id === parent
          ? group.members.filter((member: string) => !members.includes(member))
          : [];
      return { ...subgraph, members: [...members, ...lifted] };
    });
}

/** Removes a subgraph; its members move up to the subgraph's parent. Links to it are dropped. */
export function ungroup(graph: FlowGraph, groupId: string): FlowGraph {
  const group: FlowSubgraph | undefined = graph.subgraphs.find(
    (subgraph: FlowSubgraph) => subgraph.id === groupId,
  );
  if (!group) {
    return graph;
  }
  return {
    ...graph,
    subgraphs: liftMembers(graph, group, parentMap(graph.subgraphs).get(groupId)),
    edges: graph.edges.filter(
      (edge: FlowEdge) => edge.source !== groupId && edge.target !== groupId,
    ),
  };
}

/** Deletes nodes (with their links), links and subgraphs (keeping their members). */
export function deleteItems(
  graph: FlowGraph,
  { nodeIds = [], edgeIds = [], groupIds = [] }: FlowSelection,
): FlowGraph {
  const next: FlowGraph = groupIds.reduce(ungroup, graph);
  const nodes: ReadonlySet<string> = new Set<string>(nodeIds);
  const edges: ReadonlySet<string> = new Set<string>(edgeIds);
  const isDeletedEdge = (edge: FlowEdge): boolean =>
    edges.has(edge.id) || nodes.has(edge.source) || nodes.has(edge.target);
  return {
    ...next,
    nodes: next.nodes.filter((node: FlowNode) => !nodes.has(node.id)),
    edges: next.edges.filter((edge: FlowEdge) => !isDeletedEdge(edge)),
    subgraphs: withoutMembers(next.subgraphs, nodes),
  };
}

/** Moves a node into a subgraph, or to the top level with null. */
export function setNodeGroup(graph: FlowGraph, id: string, groupId: string | null): FlowGraph {
  const subgraphs: FlowSubgraph[] = addMember(
    withoutMembers(graph.subgraphs, new Set<string>([id])),
    groupId,
    id,
  );
  return { ...graph, subgraphs };
}

/** Wraps nodes in a new subgraph, nested inside their common parent, if any. */
export function groupNodes(
  graph: FlowGraph,
  ids: readonly string[],
  title: string = 'Group',
): { graph: FlowGraph; id: string } {
  const parent: Map<string, string> = parentMap(graph.subgraphs);
  const parents: Set<string | undefined> = new Set<string | undefined>(
    ids.map((id: string) => parent.get(id)),
  );
  const common: string | undefined = parents.size === 1 ? [...parents][0] : undefined;
  const id: string = uniqueId(graph, 'group');
  const rest: FlowSubgraph[] = addMember(
    withoutMembers(graph.subgraphs, new Set<string>(ids)),
    common,
    id,
  );
  // Inner subgraphs first: parentMap relies on this order.
  const group: FlowSubgraph = { id, title, members: [...ids], dir: '' };
  return { graph: { ...graph, subgraphs: [group, ...rest] }, id };
}

export function updateGroup(graph: FlowGraph, id: string, patch: Partial<FlowSubgraph>): FlowGraph {
  return {
    ...graph,
    subgraphs: graph.subgraphs.map((subgraph: FlowSubgraph) =>
      subgraph.id === id ? { ...subgraph, ...patch } : subgraph,
    ),
  };
}
