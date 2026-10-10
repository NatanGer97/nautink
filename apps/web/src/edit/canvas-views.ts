import { diagramKeyword, typeName } from '@nautink/storage/diagram-type';

import { editorIdFor, VISUAL_EDITORS } from './editor-registry.ts';
import { currentAgentName } from '../chat/agent-name.ts';

import type { EditorRegistry } from './editor-registry.ts';
import type { DiagramView } from '@nautink/storage/records';

export const CANVAS_VIEWS: readonly DiagramView[] = ['preview', 'edit', 'split'];

export const CANVAS_VIEW_LABELS: Readonly<Record<DiagramView, string>> = {
  preview: 'Preview',
  edit: 'Edit',
  split: 'Split',
};

/** Whether Edit and Split can show a visual editor for `code`, and why not when they cannot. */
export interface ViewAvailability {
  hasEditor: boolean;
  /** Empty code: Edit invites a start instead of saying there is no editor. */
  isEmpty: boolean;
  /** Why Edit and Split are off ("Visual editing isn't available for Gantt diagrams…"), or null. */
  reason: string | null;
}

/** M7: code-only types get Edit and Split disabled, with this explanation. */
export function viewAvailability(
  code: string,
  editors: EditorRegistry = VISUAL_EDITORS,
): ViewAvailability {
  const isEmpty: boolean = diagramKeyword(code) === '';
  const hasEditor: boolean = editorIdFor(code, editors) !== null;
  const reason: string | null =
    hasEditor || isEmpty
      ? null
      : `Visual editing isn't available for ${typeName(code)} diagrams. Change it in code, or ask ${currentAgentName()}.`;
  return { hasEditor, isEmpty, reason };
}

/** The view the canvas shows: Split falls back to Preview when there is no editor to put beside it. */
export function shownView(view: DiagramView, availability: ViewAvailability): DiagramView {
  return view === 'split' && !availability.hasEditor ? 'preview' : view;
}

/** What Edit says for a type without a visual editor. */
export function noEditorMessage(code: string): string {
  return `No visual editor for ${typeName(code)} yet. Use code or chat.`;
}

export function isDiagramView(value: string): value is DiagramView {
  return (CANVAS_VIEWS as readonly string[]).includes(value);
}
