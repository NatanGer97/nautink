import type { ComponentType } from 'react';

/**
 * What the host hands every visual editor (PRD §3.4). The editor owns its canvas, toolbar and
 * inspector; the host owns the code, the history and when the canvas is read-only.
 */
export interface VisualEditorProps {
  /** The open diagram. Positions and the selection are kept per diagram. */
  diagramId: string;
  /** The Mermaid code to show: the diagram's, or a viewed version's (then read-only). */
  code: string;
  isDark: boolean;
  /** Why the canvas cannot be edited right now ("Claude is editing…"), or null when it can. */
  readOnlyReason: string | null;
  /** False while an older version is shown: placing items must not overwrite saved positions. */
  canSavePositions: boolean;
  /** Records `code` as one labelled undo step (`applyEdit`, source `visual`). */
  onChange: (code: string, label: string) => void;
}

/** A visual editor: the component a registry line loads. */
export type VisualEditorComponent = ComponentType<VisualEditorProps>;
