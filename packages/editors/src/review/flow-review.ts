// A flowchart as review elements: nodes, subgraphs and links.
import { removedRefs, signature } from './review-element.ts';
import { flowEditor } from '../flow/model.ts';

import type { ReviewAdapter } from './review-adapter.ts';
import type { ReviewElement } from './review-element.ts';
import type { FlowEdge, FlowGraph, FlowNode, FlowSubgraph } from '../flow/model.ts';

function nodeElement(node: FlowNode): ReviewElement {
  const { id, ...fields } = node;
  return { id, kind: 'node', key: `node:${id}`, sig: signature(fields), label: node.label || id };
}

function groupElement(subgraph: FlowSubgraph): ReviewElement {
  const { id, title, dir } = subgraph;
  return {
    id,
    kind: 'group',
    key: `group:${id}`,
    sig: signature({ title, dir }),
    label: title || id,
  };
}

function edgeElement(edge: FlowEdge): ReviewElement {
  const { source, target, label, arrow, stroke } = edge;
  return {
    id: edge.id,
    kind: 'edge',
    key: `edge:${source}>${target}`,
    sig: signature({ label, arrow, stroke }),
    label: label || `${source} → ${target}`,
    ends: [source, target],
  };
}

/** Nodes (not the subgraphs Mermaid also lists as vertices), subgraphs, then links. */
export function flowElements(graph: FlowGraph): ReviewElement[] {
  const groupIds: Set<string> = new Set<string>(graph.subgraphs.map((subgraph) => subgraph.id));
  return [
    ...graph.nodes.filter((node: FlowNode) => !groupIds.has(node.id)).map(nodeElement),
    ...graph.subgraphs.map(groupElement),
    ...graph.edges.map(edgeElement),
  ];
}

/**
 * The proposal plus what it removed. Removed subgraphs go last: a node keeps the subgraph the
 * proposal puts it in, because the first subgraph that lists a member wins.
 */
export function flowUnion(before: FlowGraph, after: FlowGraph): FlowGraph {
  const removed: Set<string> = removedRefs(flowElements(before), flowElements(after));
  return {
    ...after,
    nodes: [...after.nodes, ...before.nodes.filter((node) => removed.has(`node:${node.id}`))],
    subgraphs: [
      ...after.subgraphs,
      ...before.subgraphs.filter((subgraph) => removed.has(`group:${subgraph.id}`)),
    ],
    edges: [...after.edges, ...before.edges.filter((edge) => removed.has(`edge:${edge.id}`))],
  };
}

export const flowReview: ReviewAdapter<FlowGraph> = {
  module: flowEditor,
  elements: flowElements,
  union: flowUnion,
};
