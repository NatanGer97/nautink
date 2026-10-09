import { useMemo } from 'react';

import { flowEdges, flowNodes } from './flow-elements.ts';
import * as handlers from './flow-handlers.ts';
import { GroupNode } from './group-node.tsx';
import { ShapeNode } from './shape-node.tsx';

import type { FlowHandlerDeps } from './flow-handlers.ts';
import type { FlowCanvasEdge, FlowCanvasNode } from './flow-types.ts';
import type { FlowEditorState } from './use-flow-editor.ts';
import type { EditorCanvasProps } from '../canvas/editor-canvas.tsx';
import type { NodeTypes } from '@xyflow/react';

// Not `group`: React Flow styles its own `group` type with a border of its own.
const NODE_TYPES: NodeTypes = { shape: ShapeNode, subgraph: GroupNode };

type FlowProps = EditorCanvasProps<FlowCanvasNode, FlowCanvasEdge>['flow'];

type EventProps = Omit<FlowProps, 'nodes' | 'edges' | 'nodeTypes'>;

function changeProps(deps: FlowHandlerDeps): EventProps {
  return {
    onNodesChange: (changes): void => {
      handlers.onNodesChange(deps, changes);
    },
    onEdgesChange: (changes): void => {
      handlers.onEdgesChange(deps, changes);
    },
    onDelete: (deleted): void => {
      handlers.onDelete(deps, deleted);
    },
    onConnect: (connection): void => {
      handlers.onConnect(deps, connection);
    },
    onConnectEnd: (event, state): void => {
      handlers.onConnectEnd(deps, event, state);
    },
  };
}

function pointerProps(deps: FlowHandlerDeps): EventProps {
  return {
    onNodeDoubleClick: (...[, node]: [unknown, FlowCanvasNode]): void => {
      handlers.onNodeDoubleClick(deps, node);
    },
    onEdgeDoubleClick: (...[, edge]: [unknown, FlowCanvasEdge]): void => {
      handlers.onEdgeDoubleClick(deps, edge);
    },
    onEdgeClick: (): void => {
      deps.setFocusEdgeLabel(false);
    },
    onPaneClick: (): void => {
      handlers.onPaneClick(deps);
    },
    onDrop: (event): void => {
      handlers.onDrop(deps, event);
    },
    onDragOver: handlers.onDragOver,
  };
}

function useEventProps(state: FlowEditorState): EventProps {
  const { context, setSelection, setEditingId, setFocusEdgeLabel, toCanvas } = state;
  const { isReadOnly } = state.core;
  return useMemo(() => {
    const deps: FlowHandlerDeps = {
      context,
      setSelection,
      setEditingId,
      setFocusEdgeLabel,
      isReadOnly,
      toCanvas,
    };
    return { ...changeProps(deps), ...pointerProps(deps) };
  }, [context, setSelection, setEditingId, setFocusEdgeLabel, isReadOnly, toCanvas]);
}

/** React Flow's nodes, edges and events for the flowchart (v1's `<ReactFlow …>` props). */
export function useFlowProps(state: FlowEditorState): FlowProps {
  const { model: graph, positions } = state.core;
  const { selection } = state;
  const nodes: FlowCanvasNode[] = useMemo(
    () => (graph === null ? [] : flowNodes(graph, positions, selection)),
    [graph, positions, selection],
  );
  const edges: FlowCanvasEdge[] = useMemo(
    () => (graph === null ? [] : flowEdges(graph, positions, selection)),
    [graph, positions, selection],
  );
  return { nodes, edges, nodeTypes: NODE_TYPES, ...useEventProps(state) };
}
