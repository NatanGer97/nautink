import { labelLines } from '@nautink/editors/flow/size';
import { parentMap } from '@nautink/editors/shared/subgraphs';

import {
  deleteSelection,
  duplicateNodes,
  groupNodes,
  reverseEdge,
  setNodeGroup,
  ungroup,
  updateEdge,
  updateGroup,
  updateNode,
  updateNodes,
} from './flow-actions.ts';
import { AssetFields } from './flow-asset-fields.tsx';
import { GROUP_DIRECTION_OPTIONS, MIXED_SHAPES, ShapePicker } from './flow-inspector-parts.tsx';
import { edgeName, nodeName } from './flow-names.ts';
import { NO_SELECTION } from './flow-types.ts';
import { InspectorActions, InspectorButton, InspectorCard } from '../canvas/inspector-card.tsx';
import { ChoiceField, CommitField, SelectField } from '../canvas/inspector-fields.tsx';
import { manyTitle } from '../canvas/many-title.ts';

import type { FlowActionContext } from './flow-actions.ts';
import type { FlowSelection } from './flow-types.ts';
import type { Choice, SelectOption } from '../canvas/inspector-fields.tsx';
import type { SelectedCount } from '../canvas/many-title.ts';
import type {
  FlowArrow,
  FlowEdge,
  FlowGraph,
  FlowNode,
  FlowStroke,
  FlowSubgraph,
} from '@nautink/editors/flow/model';
import type { ReactElement } from 'react';

export interface FlowInspectorProps {
  graph: FlowGraph;
  selection: FlowSelection;
  context: FlowActionContext;
  isReadOnly: boolean;
  /** A double-clicked link opens with its label field focused. */
  shouldFocusEdgeLabel: boolean;
}

const STROKES: readonly Choice<FlowStroke>[] = [
  { value: 'normal', label: 'Solid' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'thick', label: 'Thick' },
];

const ARROWS: readonly Choice<FlowArrow>[] = [
  { value: 'point', label: '→', name: 'Arrow' },
  { value: 'open', label: '—', name: 'No arrow' },
  { value: 'circle', label: '○', name: 'Circle' },
  { value: 'cross', label: '×', name: 'Cross' },
];

function GroupMembership({
  graph,
  node,
  context,
}: {
  graph: FlowGraph;
  node: FlowNode;
  context: FlowActionContext;
}): ReactElement | null {
  if (graph.subgraphs.length === 0) {
    return null;
  }
  const options: SelectOption[] = [
    { value: '', label: 'None' },
    ...graph.subgraphs.map((group) => ({
      value: group.id,
      label: group.title === '' ? group.id : group.title,
    })),
  ];
  return (
    <SelectField
      label="Group"
      value={parentMap(graph.subgraphs).get(node.id) ?? ''}
      groups={[{ label: 'Groups', options }]}
      onChange={(groupId) => {
        setNodeGroup(context, node.id, groupId === '' ? null : groupId);
      }}
    />
  );
}

function NodeInspector({
  graph,
  node,
  context,
  isReadOnly,
}: {
  graph: FlowGraph;
  node: FlowNode;
  context: FlowActionContext;
  isReadOnly: boolean;
}): ReactElement {
  const isAsset: boolean = node.icon !== undefined || node.img !== undefined;
  return (
    <InspectorCard title="Node" subtitle={node.id} isReadOnly={isReadOnly}>
      <CommitField
        label="Label"
        isMultiline
        value={labelLines(node.label).join('\n')}
        onCommit={(text) => {
          updateNode(context, node.id, { label: text.split('\n').join('<br>') });
        }}
      />
      {isAsset ? (
        <AssetFields node={node} context={context} />
      ) : (
        <ShapePicker
          value={node.shape}
          onChange={(shape) => {
            updateNode(context, node.id, { shape });
          }}
        />
      )}
      <GroupMembership graph={graph} node={node} context={context} />
      <InspectorActions>
        <InspectorButton
          onClick={() => {
            groupNodes(context, [node.id]);
          }}
        >
          Wrap in group
        </InspectorButton>
        <InspectorButton
          onClick={() => {
            duplicateNodes(context, [node.id]);
          }}
        >
          Duplicate
        </InspectorButton>
        <InspectorButton
          isDestructive
          onClick={() => {
            deleteSelection(context, { ...NO_SELECTION, nodes: [node.id] });
          }}
        >
          Delete
        </InspectorButton>
      </InspectorActions>
    </InspectorCard>
  );
}

function EdgeInspector({
  graph,
  edge,
  context,
  isReadOnly,
  shouldFocusLabel,
}: {
  graph: FlowGraph;
  edge: FlowEdge;
  context: FlowActionContext;
  isReadOnly: boolean;
  shouldFocusLabel: boolean;
}): ReactElement {
  return (
    <InspectorCard title="Link" subtitle={edgeName(graph, edge.id)} isReadOnly={isReadOnly}>
      <CommitField
        label="Label"
        value={edge.label}
        placeholder="None"
        shouldFocus={shouldFocusLabel}
        onCommit={(label) => {
          updateEdge(context, edge.id, { label });
        }}
      />
      <ChoiceField
        label="Line"
        value={edge.stroke}
        choices={STROKES}
        onChange={(stroke) => {
          updateEdge(context, edge.id, { stroke });
        }}
      />
      <ChoiceField
        label="End"
        value={edge.arrow}
        choices={ARROWS}
        onChange={(arrow) => {
          updateEdge(context, edge.id, { arrow });
        }}
      />
      <InspectorActions>
        <InspectorButton
          onClick={() => {
            reverseEdge(context, edge.id);
          }}
        >
          Reverse
        </InspectorButton>
        <InspectorButton
          isDestructive
          onClick={() => {
            deleteSelection(context, { ...NO_SELECTION, edges: [edge.id] });
          }}
        >
          Delete
        </InspectorButton>
      </InspectorActions>
    </InspectorCard>
  );
}

function GroupInspector({
  group,
  context,
  isReadOnly,
}: {
  group: FlowSubgraph;
  context: FlowActionContext;
  isReadOnly: boolean;
}): ReactElement {
  return (
    <InspectorCard title="Group" subtitle={group.id} isReadOnly={isReadOnly}>
      <CommitField
        label="Title"
        value={group.title}
        placeholder={group.id}
        onCommit={(title) => {
          updateGroup(context, group.id, { title });
        }}
      />
      <SelectField
        label="Direction"
        value={group.dir}
        groups={GROUP_DIRECTION_OPTIONS}
        onChange={(dir) => {
          updateGroup(context, group.id, { dir });
        }}
      />
      <InspectorActions>
        <InspectorButton
          onClick={() => {
            ungroup(context, group.id);
          }}
        >
          Ungroup
        </InspectorButton>
      </InspectorActions>
    </InspectorCard>
  );
}

function manyCounts(selection: FlowSelection): SelectedCount[] {
  return [
    { count: selection.nodes.length, plural: 'nodes' },
    { count: selection.edges.length, plural: 'links' },
  ];
}

/** The selected nodes that have a shape (not icons or images), and their shape when they share one. */
function bulkShape(graph: FlowGraph, ids: readonly string[]): { ids: string[]; shape: string } {
  const shaped: FlowNode[] = graph.nodes.filter(
    (node) => ids.includes(node.id) && node.icon === undefined && node.img === undefined,
  );
  const shapes: Set<string> = new Set<string>(shaped.map((node) => node.shape));
  const [only] = shapes;
  return {
    ids: shaped.map((node) => node.id),
    shape: shapes.size === 1 ? (only ?? '') : MIXED_SHAPES,
  };
}

function ManyActions({
  selection,
  context,
}: {
  selection: FlowSelection;
  context: FlowActionContext;
}): ReactElement {
  const hasNodes: boolean = selection.nodes.length > 0;
  return (
    <InspectorActions>
      {hasNodes ? (
        <InspectorButton
          onClick={() => {
            groupNodes(context, selection.nodes);
          }}
        >
          Group
        </InspectorButton>
      ) : null}
      {hasNodes ? (
        <InspectorButton
          onClick={() => {
            duplicateNodes(context, selection.nodes);
          }}
        >
          Duplicate
        </InspectorButton>
      ) : null}
      <InspectorButton
        isDestructive
        onClick={() => {
          deleteSelection(context, selection);
        }}
      >
        Delete
      </InspectorButton>
    </InspectorActions>
  );
}

/** Several nodes and links: one shape for all the nodes, Group, Duplicate and Delete. */
function ManyInspector({
  graph,
  selection,
  context,
  isReadOnly,
}: {
  graph: FlowGraph;
  selection: FlowSelection;
  context: FlowActionContext;
  isReadOnly: boolean;
}): ReactElement {
  const names: string = [
    ...selection.nodes.map((id) => nodeName(graph, id)),
    ...selection.edges.map((id) => edgeName(graph, id)),
  ].join(', ');
  const shape: { ids: string[]; shape: string } = bulkShape(graph, selection.nodes);
  return (
    <InspectorCard
      title={manyTitle(manyCounts(selection))}
      subtitle={names}
      isReadOnly={isReadOnly}
    >
      {shape.ids.length > 0 ? (
        <ShapePicker
          value={shape.shape}
          onChange={(next) => {
            if (next !== MIXED_SHAPES) {
              updateNodes(context, shape.ids, { shape: next });
            }
          }}
        />
      ) : null}
      <ManyActions selection={selection} context={context} />
    </InspectorCard>
  );
}

/** The floating inspector (M1) for what is selected: a node, a link, a group or several items. */
export function FlowInspector({
  graph,
  selection,
  context,
  isReadOnly,
  shouldFocusEdgeLabel,
}: FlowInspectorProps): ReactElement | null {
  const shared: { graph: FlowGraph; context: FlowActionContext; isReadOnly: boolean } = {
    graph,
    context,
    isReadOnly,
  };
  if (selection.nodes.length + selection.edges.length > 1) {
    return <ManyInspector {...shared} selection={selection} />;
  }
  const node: FlowNode | undefined = graph.nodes.find((item) => item.id === selection.nodes[0]);
  if (node !== undefined) {
    return <NodeInspector {...shared} node={node} />;
  }
  const edge: FlowEdge | undefined = graph.edges.find((item) => item.id === selection.edges[0]);
  if (selection.edges.length === 1 && edge !== undefined) {
    return <EdgeInspector {...shared} edge={edge} shouldFocusLabel={shouldFocusEdgeLabel} />;
  }
  const group: FlowSubgraph | undefined = graph.subgraphs.find(
    (item) => item.id === selection.group,
  );
  if (group !== undefined) {
    return <GroupInspector group={group} context={context} isReadOnly={isReadOnly} />;
  }
  return null;
}
