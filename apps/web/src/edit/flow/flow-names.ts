import { clip } from '@nautink/visual-core/text';

import type { FlowEdge, FlowGraph, FlowNode, FlowSubgraph } from '@nautink/editors/flow/model';

const NAME_CLIP: number = 28;

/** A node's or group's name in step labels: its label, else its title, else its id. */
export function nodeName(graph: FlowGraph, id: string): string {
  const node: FlowNode | undefined = graph.nodes.find((item) => item.id === id);
  const group: FlowSubgraph | undefined = graph.subgraphs.find((item) => item.id === id);
  const name: string =
    [node?.label, group?.title].find((text) => text !== undefined && text !== '') ?? id;
  return clip(name, NAME_CLIP);
}

/** "Start → Done" for a link, or '' when there is no such link. */
export function edgeName(graph: FlowGraph, id: string): string {
  const edge: FlowEdge | undefined = graph.edges.find((item) => item.id === id);
  return edge === undefined
    ? ''
    : `${nodeName(graph, edge.source)} → ${nodeName(graph, edge.target)}`;
}
