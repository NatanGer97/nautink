import { describe, expect, it } from 'vitest';

import { emptyModel } from './model.ts';
import {
  addEdge,
  addNode,
  deleteItems,
  groupNodes,
  reverseEdge,
  setNodeGroup,
  ungroup,
  updateEdge,
  updateGroup,
  updateNode,
} from './ops.ts';

import type { FlowGraph } from './model.ts';

function sample(): FlowGraph {
  return {
    ...emptyModel(),
    nodes: ['a', 'b', 'c'].map((id) => ({
      id,
      label: id.toUpperCase(),
      shape: 'rect',
      classes: [],
    })),
    edges: [
      { id: 'L_a_b_0', source: 'a', target: 'b', label: '', arrow: 'point', stroke: 'normal' },
      { id: 'L_b_c_0', source: 'b', target: 'c', label: '', arrow: 'point', stroke: 'normal' },
    ],
    subgraphs: [
      { id: 'inner', title: '', members: ['b'], dir: '' },
      { id: 'outer', title: 'Outer', members: ['a', 'inner'], dir: '' },
    ],
  };
}

describe('nodes', () => {
  it('adds a node with no classes, optionally inside a group', () => {
    const graph = addNode(sample(), { id: 'd', label: 'D', shape: 'rect' }, 'inner');
    expect(graph.nodes.at(-1)).toEqual({ id: 'd', label: 'D', shape: 'rect', classes: [] });
    expect(graph.subgraphs[0]!.members).toEqual(['b', 'd']);
    expect(
      addNode(sample(), { id: 'e', label: 'E', shape: 'rect', classes: ['x'] }).subgraphs,
    ).toEqual(sample().subgraphs);
  });

  it('patches a node', () => {
    expect(updateNode(sample(), 'a', { label: 'New' }).nodes[0]!.label).toBe('New');
  });
});

describe('edges', () => {
  it('adds an edge with the next free id and defaults', () => {
    const graph = addEdge(sample(), { source: 'a', target: 'b' });
    expect(graph.edges.at(-1)).toEqual({
      id: 'L_a_b_1',
      source: 'a',
      target: 'b',
      label: '',
      arrow: 'point',
      stroke: 'normal',
    });
    expect(
      addEdge(sample(), { source: 'c', target: 'a', stroke: 'dotted' }).edges.at(-1),
    ).toMatchObject({
      id: 'L_c_a_0',
      stroke: 'dotted',
    });
  });

  it('patches and reverses an edge', () => {
    expect(updateEdge(sample(), 'L_a_b_0', { label: 'go' }).edges[0]!.label).toBe('go');
    expect(reverseEdge(sample(), 'L_a_b_0').edges[0]).toMatchObject({ source: 'b', target: 'a' });
    expect(reverseEdge(sample(), 'L_a_b_0').edges[1]).toEqual(sample().edges[1]);
  });
});

describe('groups', () => {
  it('ungroups into the parent group and drops links to the group', () => {
    const linked = addEdge(sample(), { source: 'inner', target: 'c' });
    const graph = ungroup(linked, 'inner');
    expect(graph.subgraphs).toEqual([
      { id: 'outer', title: 'Outer', members: ['a', 'b'], dir: '' },
    ]);
    expect(graph.edges.map((edge) => edge.id)).toEqual(['L_a_b_0', 'L_b_c_0']);
  });

  it('ungroups a top-level group and ignores unknown ids', () => {
    expect(ungroup(sample(), 'outer').subgraphs).toEqual([
      { id: 'inner', title: '', members: ['b'], dir: '' },
    ]);
    expect(ungroup(sample(), 'nope')).toEqual(sample());
  });

  it('wraps nodes in a group nested in their common parent', () => {
    const { graph, id } = groupNodes(sample(), ['a'], 'New');
    expect(id).toBe('group1');
    expect(graph.subgraphs[0]).toEqual({ id: 'group1', title: 'New', members: ['a'], dir: '' });
    expect(graph.subgraphs.find((subgraph) => subgraph.id === 'outer')!.members).toEqual([
      'inner',
      'group1',
    ]);
  });

  it('puts a group of nodes with different parents at the top level', () => {
    const { graph } = groupNodes(sample(), ['a', 'c']);
    expect(graph.subgraphs[0]!.title).toBe('Group');
    expect(graph.subgraphs.find((subgraph) => subgraph.id === 'outer')!.members).toEqual(['inner']);
  });

  it('moves a node between groups', () => {
    expect(setNodeGroup(sample(), 'b', 'outer').subgraphs).toEqual([
      { id: 'inner', title: '', members: [], dir: '' },
      { id: 'outer', title: 'Outer', members: ['a', 'inner', 'b'], dir: '' },
    ]);
    expect(setNodeGroup(sample(), 'a', null).subgraphs[1]!.members).toEqual(['inner']);
  });

  it('patches a group', () => {
    expect(updateGroup(sample(), 'outer', { dir: 'LR' }).subgraphs[1]!.dir).toBe('LR');
  });
});

describe('deleteItems', () => {
  it('deletes nodes with their links and group membership', () => {
    const graph = deleteItems(sample(), { nodeIds: ['b'] });
    expect(graph.nodes.map((node) => node.id)).toEqual(['a', 'c']);
    expect(graph.edges).toEqual([]);
    expect(graph.subgraphs[0]!.members).toEqual([]);
  });

  it('deletes links and groups', () => {
    const graph = deleteItems(sample(), { edgeIds: ['L_a_b_0'], groupIds: ['inner'] });
    expect(graph.edges.map((edge) => edge.id)).toEqual(['L_b_c_0']);
    expect(graph.subgraphs.map((subgraph) => subgraph.id)).toEqual(['outer']);
  });

  it('does nothing for an empty selection', () => {
    expect(deleteItems(sample(), {})).toEqual(sample());
  });
});
