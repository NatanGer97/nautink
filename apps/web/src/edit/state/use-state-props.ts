import { useMemo } from 'react';

import { stateEdges, stateNodes } from './state-elements.ts';
import { stateGeometry } from './state-geometry.ts';
import * as handlers from './state-handlers.ts';
import { CompositeNodeView, RegionNodeView, StateLeafView } from './state-nodes.tsx';
import { TransitionEdge } from './transition-edge.tsx';

import type { StateGeometry } from './state-geometry.ts';
import type { StateHandlerDeps } from './state-handlers.ts';
import type { StateCanvasEdge, StateCanvasNode } from './state-types.ts';
import type { StateEditorState } from './use-state-editor.ts';
import type { EditorCanvasProps } from '../canvas/editor-canvas.tsx';
import type { EdgeTypes, NodeTypes } from '@xyflow/react';

// Not `group`: React Flow styles its own `group` type with a border of its own.
const NODE_TYPES: NodeTypes = {
  leaf: StateLeafView,
  composite: CompositeNodeView,
  region: RegionNodeView,
};

const EDGE_TYPES: EdgeTypes = { transition: TransitionEdge };

type StateFlowProps = EditorCanvasProps<StateCanvasNode, StateCanvasEdge>['flow'];

type EventProps = Omit<StateFlowProps, 'nodes' | 'edges' | 'nodeTypes' | 'edgeTypes'>;

/** Frames stay under their content when selected (v1). */
const FIXED: Pick<StateFlowProps, 'elevateNodesOnSelect'> = { elevateNodesOnSelect: false };

function changeProps(deps: StateHandlerDeps): EventProps {
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
  };
}

function connectProps(deps: StateHandlerDeps): EventProps {
  return {
    onConnect: (connection): void => {
      handlers.onConnect(deps, connection);
    },
    onConnectEnd: (event, state): void => {
      handlers.onConnectEnd(deps, event, state);
    },
    isValidConnection: (connection): boolean =>
      handlers.isValidConnection(deps.context, connection),
  };
}

function pointerProps(deps: StateHandlerDeps): EventProps {
  return {
    onNodeDoubleClick: (...[, node]: [unknown, StateCanvasNode]): void => {
      handlers.onNodeDoubleClick(deps, node);
    },
    onEdgeDoubleClick: (...[, edge]: [unknown, StateCanvasEdge]): void => {
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

function useEventProps(state: StateEditorState): EventProps {
  const { context, selection, setSelection, setEditingId, setFocusEdgeLabel, toCanvas } = state;
  const { isReadOnly } = state.core;
  return useMemo(() => {
    const deps: StateHandlerDeps = {
      context,
      selection,
      setSelection,
      setEditingId,
      setFocusEdgeLabel,
      isReadOnly,
      toCanvas,
    };
    return { ...changeProps(deps), ...connectProps(deps), ...pointerProps(deps) };
  }, [context, selection, setSelection, setEditingId, setFocusEdgeLabel, isReadOnly, toCanvas]);
}

/** React Flow's nodes, edges and events for the state diagram (v1's `<ReactFlow …>` props). */
export function useStateProps(state: StateEditorState): StateFlowProps {
  const { model, positions } = state.core;
  const { selection } = state;
  const geometry: StateGeometry | null = useMemo(
    () => (model === null ? null : stateGeometry(model, positions)),
    [model, positions],
  );
  const nodes: StateCanvasNode[] = useMemo(
    () => (model === null || geometry === null ? [] : stateNodes(model, geometry, selection)),
    [model, geometry, selection],
  );
  const edges: StateCanvasEdge[] = useMemo(
    () => (model === null || geometry === null ? [] : stateEdges(model, geometry, selection)),
    [model, geometry, selection],
  );
  const events: EventProps = useEventProps(state);
  return { nodes, edges, nodeTypes: NODE_TYPES, edgeTypes: EDGE_TYPES, ...events, ...FIXED };
}
