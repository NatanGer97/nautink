import { describe, expect, it } from 'vitest';

import {
  addShape,
  connect,
  deleteSelection,
  DUPLICATE_OFFSET,
  duplicateNodes,
  groupNodes,
  newNode,
  renameNode,
  reverseEdge,
  setDirection,
  setNodeGroup,
  ungroup,
  updateEdge,
  updateGroup,
  updateNode,
  updateNodes,
} from './flow-actions.ts';
import { NO_SELECTION } from './flow-types.ts';
import { testContext } from '../../../tests/flow-fixtures.ts';

function lastLabel(context: ReturnType<typeof testContext>): string | undefined {
  return context.commits.mock.calls.at(-1)?.[1];
}

describe('flowchart actions', () => {
  it('adds a shape in free space, selects it and opens its label for typing', () => {
    const context = testContext();
    addShape(context, { spec: { shape: 'diam' }, at: { x: 0, y: 0 } });
    expect(lastLabel(context)).toBe('Added node Decision');
    expect(context.graph().nodes.at(-1)).toMatchObject({
      id: 'n1',
      shape: 'diam',
      label: 'Decision',
    });
    expect(context.stored().n1).toBeDefined();
    expect(context.selections.at(-1)).toEqual({ ...NO_SELECTION, nodes: ['n1'] });
    expect(context.setEditingId).toHaveBeenCalledWith('n1');
  });

  it('adds a node at the end of a dropped link, in the same group', () => {
    const context = testContext();
    addShape(context, { spec: { shape: 'rect' }, at: { x: 50, y: 50 }, connectFrom: 'B' });
    expect(lastLabel(context)).toBe('Added node Process after Check');
    expect(context.graph().edges.at(-1)).toMatchObject({ source: 'B', target: 'n1' });
    expect(context.graph().subgraphs[0]?.members).toEqual(['B', 'n1']);
  });

  it('adds icon nodes named after their icon', () => {
    expect(newNode({ icon: 'logos:aws-lambda', form: 'circle' }, 'n9')).toEqual({
      id: 'n9',
      shape: 'rect',
      icon: 'logos:aws-lambda',
      form: 'circle',
      pos: 'b',
      h: 48,
      label: 'aws lambda',
      classes: [],
    });
    expect(newNode({ shape: 'unknown' }, 'n1').label).toBe('Node');
  });

  it('labels patch edits as v1 did', () => {
    const context = testContext();
    updateNode(context, 'A', { label: 'Begin' });
    expect(lastLabel(context)).toBe('Renamed Start → Begin');
    updateNode(context, 'B', { shape: 'hex' });
    expect(lastLabel(context)).toBe('Changed shape of Check');
    updateEdge(context, 'L_A_B_0', { stroke: 'thick' });
    expect(lastLabel(context)).toBe('Changed line style of Begin → Check');
    updateGroup(context, 'G', { title: 'Tests' });
    expect(lastLabel(context)).toBe('Renamed Checks → Tests');
    reverseEdge(context, 'L_B_C_0');
    expect(lastLabel(context)).toBe('Reversed link Check → Done');
    connect(context, 'A', 'C');
    expect(lastLabel(context)).toBe('Connected Begin → Done');
  });

  it('gives several nodes one shape as one step', () => {
    const context = testContext();
    updateNodes(context, [], { shape: 'hex' });
    expect(context.commits).not.toHaveBeenCalled();
    updateNodes(context, ['A', 'C'], { shape: 'hex' });
    expect(lastLabel(context)).toBe('Changed shape of 2 nodes');
    expect(context.graph().nodes.map((node) => node.shape)).toEqual(['hex', 'diam', 'hex']);
    updateNodes(context, ['B'], { shape: 'rect' });
    expect(lastLabel(context)).toBe('Changed shape of Check');
  });

  it('renames only when the label changed', () => {
    const context = testContext();
    renameNode(context, 'A', 'Start');
    renameNode(context, 'missing', 'X');
    expect(context.commits).not.toHaveBeenCalled();
    renameNode(context, 'A', 'Go');
    expect(lastLabel(context)).toBe('Renamed Start → Go');
  });

  it('deletes nodes with their links, counting only links of their own', () => {
    const context = testContext();
    deleteSelection(context, NO_SELECTION);
    expect(context.commits).not.toHaveBeenCalled();
    deleteSelection(context, { nodes: ['A'], edges: ['L_A_B_0'], group: null });
    expect(lastLabel(context)).toBe('Deleted Start');
    deleteSelection(context, { nodes: [], edges: ['L_B_C_0'], group: 'G' });
    expect(lastLabel(context)).toBe('Deleted 2 items');
    expect(context.graph().subgraphs).toEqual([]);
    expect(context.selections.at(-1)).toEqual(NO_SELECTION);
  });

  it('duplicates next to the originals and selects the copies', () => {
    const context = testContext();
    duplicateNodes(context, []);
    duplicateNodes(context, ['G']);
    expect(context.commits).not.toHaveBeenCalled();
    duplicateNodes(context, ['A']);
    expect(lastLabel(context)).toBe('Duplicated Start');
    expect(context.stored().n1).toEqual({ x: DUPLICATE_OFFSET, y: DUPLICATE_OFFSET });
    duplicateNodes(context, ['A', 'B']);
    expect(lastLabel(context)).toBe('Duplicated 2 nodes');
    expect(context.selections.at(-1)?.nodes).toEqual(['n2', 'n3']);
  });

  it('groups, moves into and out of groups, and ungroups', () => {
    const context = testContext();
    groupNodes(context, []);
    groupNodes(context, ['A', 'C']);
    expect(lastLabel(context)).toBe('Grouped 2 nodes');
    expect(context.selections.at(-1)?.group).toBe('group1');
    groupNodes(context, ['C']);
    expect(lastLabel(context)).toBe('Grouped 1 node');
    setNodeGroup(context, 'A', 'G');
    expect(lastLabel(context)).toBe('Moved Start into Checks');
    setNodeGroup(context, 'A', null);
    expect(lastLabel(context)).toBe('Moved Start out of its group');
    ungroup(context, 'G');
    expect(lastLabel(context)).toBe('Ungrouped Checks');
  });

  it('changes direction with a fresh layout, and skips the same direction', () => {
    const context = testContext();
    setDirection(context, 'TD');
    expect(context.commits).not.toHaveBeenCalled();
    setDirection(context, 'LR');
    expect(lastLabel(context)).toBe('Changed direction to LR');
    expect(context.graph().direction).toBe('LR');
    expect(context.requestFit).toHaveBeenCalled();
  });

  it('does nothing before the diagram has parsed', () => {
    const context = { ...testContext(), getGraph: (): null => null };
    addShape(context, { spec: { shape: 'rect' }, at: { x: 0, y: 0 } });
    duplicateNodes(context, ['A']);
    setDirection(context, 'LR');
    updateNode(context, 'A', { label: 'x' });
    expect(context.commits).not.toHaveBeenCalled();
  });
});
