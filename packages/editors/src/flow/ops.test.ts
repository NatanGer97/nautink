import { describe, expect, it } from 'vitest';

import { emptyModel } from './model.ts';
import {
  addEdge,
  addNode,
  deleteItems,
  duplicateNodes,
  groupNodes,
  reverseEdge,
  setNodeGroup,
  ungroup,
  updateEdge,
  updateGroup,
  updateNode,
  updateNodes,
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

  it('patches several nodes at once and leaves the others', () => {
    const graph = updateNodes(sample(), ['a', 'c', 'gone'], { shape: 'circle' });
    expect(graph.nodes.map((node) => node.shape)).toEqual(['circle', 'rect', 'circle']);
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

describe('duplicateNodes', () => {
  it('copies nodes and the links between them into their groups, under fresh ids', () => {
    const graph = {
      ...sample(),
      nodes: [...sample().nodes, { id: 'n1', label: 'N', shape: 'rect', classes: ['hot'] }],
    };
    const { graph: next, copies } = duplicateNodes(graph, ['a', 'b', 'inner', 'missing']);
    expect([...copies]).toEqual([
      ['a', 'n2'],
      ['b', 'n3'],
    ]);
    expect(next.nodes.slice(-2)).toEqual([
      { id: 'n2', label: 'A', shape: 'rect', classes: [] },
      { id: 'n3', label: 'B', shape: 'rect', classes: [] },
    ]);
    expect(next.edges.slice(2)).toEqual([
      { id: 'L_n2_n3_0', source: 'n2', target: 'n3', label: '', arrow: 'point', stroke: 'normal' },
    ]);
    expect(next.subgraphs.find((subgraph) => subgraph.id === 'inner')?.members).toEqual([
      'b',
      'n3',
    ]);
    expect(next.subgraphs.find((subgraph) => subgraph.id === 'outer')?.members).toEqual([
      'a',
      'inner',
      'n2',
    ]);
  });

  it('keeps top-level copies at the top level and copies classes', () => {
    const graph = {
      ...sample(),
      nodes: [{ id: 'x', label: 'X', shape: 'diam', classes: ['hot'] }],
      subgraphs: [],
    };
    const { graph: next } = duplicateNodes(graph, ['x']);
    expect(next.nodes[1]).toEqual({ id: 'n1', label: 'X', shape: 'diam', classes: ['hot'] });
    expect(next.subgraphs).toEqual([]);
  });
});
