import '@xyflow/react/dist/style.css';
import './react-flow-theme.css';
import { ConnectionMode, ReactFlow } from '@xyflow/react';

import { ReadOnlyBanner } from './canvas-notices.tsx';
import { FlowZoomControls } from './flow-zoom-controls.tsx';
import { useFitOnRequest } from './use-canvas-fit.ts';

import type { Edge, Node, ReactFlowProps } from '@xyflow/react';
import type { ReactElement, ReactNode, RefObject } from 'react';

const MIN_ZOOM: number = 0.1;
const MAX_ZOOM: number = 3;
const CONNECTION_RADIUS_PX: number = 28;
const DELETE_KEYS: string[] = ['Backspace', 'Delete'];
const MULTI_SELECT_KEYS: string[] = ['Shift', 'Meta', 'Control'];

/** The React Flow props an editor sets itself; the rest are the same on every canvas. */
type FlowProps<N extends Node, E extends Edge> = Omit<
  ReactFlowProps<N, E>,
  'colorMode' | 'nodesDraggable' | 'nodesConnectable' | 'deleteKeyCode' | 'proOptions'
>;

export interface EditorCanvasProps<N extends Node, E extends Edge> {
  flow: FlowProps<N, E>;
  isDark: boolean;
  isReadOnly: boolean;
  /** Why it is read-only, shown as a banner (the syntax error, Claude editing). */
  readOnlyReason: string | null;
  fitRequest: number;
  /** The editor's root, so window shortcuts know when the canvas has focus. */
  rootRef: RefObject<HTMLDivElement | null>;
  /** Floating chrome over the canvas: the toolbar, the inspector, a library, hints. */
  children?: ReactNode;
}

function FitOnRequest({ fitRequest }: { fitRequest: number }): null {
  useFitOnRequest(fitRequest);
  return null;
}

/**
 * React Flow as every visual editor uses it: token colors, read-only handling, Delete/Backspace,
 * Shift/⌘ multi-select, no double-click zoom (double-click renames), the zoom bar and fit requests.
 * Render it inside a `ReactFlowProvider`.
 */
export function EditorCanvas<N extends Node, E extends Edge>({
  flow,
  isDark,
  isReadOnly,
  readOnlyReason,
  fitRequest,
  rootRef,
  children,
}: EditorCanvasProps<N, E>): ReactElement {
  return (
    <div ref={rootRef} className="nautink-flow @container absolute inset-0">
      <ReactFlow<N, E>
        connectionMode={ConnectionMode.Loose}
        connectionRadius={CONNECTION_RADIUS_PX}
        multiSelectionKeyCode={MULTI_SELECT_KEYS}
        selectionKeyCode="Shift"
        zoomOnDoubleClick={false}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        {...flow}
        colorMode={isDark ? 'dark' : 'light'}
        nodesDraggable={!isReadOnly}
        nodesConnectable={!isReadOnly}
        deleteKeyCode={isReadOnly ? null : DELETE_KEYS}
        proOptions={{ hideAttribution: true }}
      >
        <FitOnRequest fitRequest={fitRequest} />
        <FlowZoomControls />
      </ReactFlow>
      {children}
      <ReadOnlyBanner reason={readOnlyReason} />
    </div>
  );
}
