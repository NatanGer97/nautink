import { useMemo } from 'react';

import { EntityNode } from './entity-node.tsx';
import { ErEdge } from './er-edge.tsx';
import { erEdges, erNodes } from './er-elements.ts';
import { ErGroupNode } from './er-group-node.tsx';
import * as handlers from './er-handlers.ts';

import type { ErHandlerDeps } from './er-handlers.ts';
import type { ErCanvasEdge, ErCanvasNode } from './er-types.ts';
import type { ErEditorState } from './use-er-editor.ts';
import type { EditorCanvasProps } from '../canvas/editor-canvas.tsx';
import type { EdgeTypes, NodeTypes } from '@xyflow/react';

// Not `group`: React Flow styles its own `group` type with a border of its own.
const NODE_TYPES: NodeTypes = { entity: EntityNode, subgraph: ErGroupNode };
const EDGE_TYPES: EdgeTypes = { relationship: ErEdge };

type ErFlowProps = EditorCanvasProps<ErCanvasNode, ErCanvasEdge>['flow'];

type EventProps = Omit<ErFlowProps, 'nodes' | 'edges' | 'nodeTypes' | 'edgeTypes'>;

function changeProps(deps: ErHandlerDeps): EventProps {
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

function pointerProps(deps: ErHandlerDeps): EventProps {
  return {
    onNodeDoubleClick: (...[, node]: [unknown, ErCanvasNode]): void => {
      if (node.type === 'entity') {
        handlers.onDoubleClickItem(deps, node.id);
      }
    },
    onEdgeDoubleClick: (...[, edge]: [unknown, ErCanvasEdge]): void => {
      handlers.onDoubleClickItem(deps, edge.id);
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

function useEventProps(state: ErEditorState): EventProps {
  const { context, setSelection, setEditingId, toCanvas } = state;
  const { isReadOnly } = state.core;
  return useMemo(() => {
    const deps: ErHandlerDeps = { context, setSelection, setEditingId, isReadOnly, toCanvas };
    return { ...changeProps(deps), ...pointerProps(deps) };
  }, [context, setSelection, setEditingId, isReadOnly, toCanvas]);
}

/** React Flow's nodes, edges and events for the ER diagram (v1's `<ReactFlow …>` props). */
export function useErProps(state: ErEditorState): ErFlowProps {
  const { model, positions } = state.core;
  const { selection } = state;
  const nodes: ErCanvasNode[] = useMemo(
    () => (model === null ? [] : erNodes(model, positions, selection)),
    [model, positions, selection],
  );
  const edges: ErCanvasEdge[] = useMemo(
    () => (model === null ? [] : erEdges(model, positions, selection)),
    [model, positions, selection],
  );
  return {
    nodes,
    edges,
    nodeTypes: NODE_TYPES,
    edgeTypes: EDGE_TYPES,
    ...useEventProps(state),
  };
}
