import { useMemo } from 'react';

import { classBoxes } from './class-boxes.ts';
import { classEdges } from './class-edges.ts';
import { classNodes } from './class-elements.ts';
import * as handlers from './class-handlers.ts';
import { ClassNode } from './class-node.tsx';
import { LolliNode, NamespaceFrame, NoteNode } from './class-small-nodes.tsx';
import { NoteLink, UmlEdge } from './uml-edge.tsx';

import type { ClassHandlerDeps } from './class-handlers.ts';
import type { ClassCanvasEdge, ClassCanvasNode } from './class-types.ts';
import type { ClassEditorState } from './use-class-editor.ts';
import type { EditorCanvasProps } from '../canvas/editor-canvas.tsx';
import type { EdgeTypes, NodeTypes } from '@xyflow/react';

const NODE_TYPES: NodeTypes = {
  cls: ClassNode,
  note: NoteNode,
  lolli: LolliNode,
  nsframe: NamespaceFrame,
};
const EDGE_TYPES: EdgeTypes = { uml: UmlEdge, notelink: NoteLink };

type ClassFlowProps = EditorCanvasProps<ClassCanvasNode, ClassCanvasEdge>['flow'];

type EventProps = Omit<ClassFlowProps, 'nodes' | 'edges' | 'nodeTypes' | 'edgeTypes'>;

function changeProps(deps: ClassHandlerDeps): EventProps {
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
    isValidConnection: (connection): boolean => handlers.isValidConnection(deps, connection),
    onConnect: (connection): void => {
      handlers.onConnect(deps, connection);
    },
    onConnectEnd: (event, state): void => {
      handlers.onConnectEnd(deps, event, state);
    },
  };
}

function pointerProps(deps: ClassHandlerDeps): EventProps {
  return {
    onNodeDoubleClick: (...[, node]: [unknown, ClassCanvasNode]): void => {
      handlers.onNodeDoubleClick(deps, node);
    },
    onEdgeDoubleClick: (...[, edge]: [unknown, ClassCanvasEdge]): void => {
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

type StableDeps = Pick<
  ClassHandlerDeps,
  'setSelection' | 'setEditing' | 'setFocusEdgeLabel' | 'toCanvas' | 'move'
>;

/** The handler deps that never change while the editor is open (setters, the position book). */
function useStableDeps(state: ClassEditorState): StableDeps {
  const { setSelection, setEditing, setFocusEdgeLabel, toCanvas } = state;
  const { book } = state.core;
  return useMemo(
    () => ({ setSelection, setEditing, setFocusEdgeLabel, toCanvas, move: book.move }),
    [setSelection, setEditing, setFocusEdgeLabel, toCanvas, book],
  );
}

function useEventProps(state: ClassEditorState): EventProps {
  const stable: StableDeps = useStableDeps(state);
  const { context, selection, relationKind } = state;
  const { isReadOnly } = state.core;
  return useMemo(() => {
    const deps: ClassHandlerDeps = { ...stable, context, selection, relationKind, isReadOnly };
    return { ...changeProps(deps), ...pointerProps(deps) };
  }, [stable, context, selection, relationKind, isReadOnly]);
}

/** React Flow's nodes, edges and events for the class diagram (v1's `<ReactFlow …>` props). */
export function useClassProps(state: ClassEditorState): ClassFlowProps {
  const { model, positions, isReadOnly } = state.core;
  const { selection } = state;
  const nodes: ClassCanvasNode[] = useMemo(
    () => (model === null ? [] : classNodes({ model, positions, selection, isReadOnly })),
    [model, positions, selection, isReadOnly],
  );
  const edges: ClassCanvasEdge[] = useMemo(
    () => (model === null ? [] : classEdges(model, classBoxes(model, positions), selection)),
    [model, positions, selection],
  );
  const events: EventProps = useEventProps(state);
  return { nodes, edges, nodeTypes: NODE_TYPES, edgeTypes: EDGE_TYPES, ...events };
}
