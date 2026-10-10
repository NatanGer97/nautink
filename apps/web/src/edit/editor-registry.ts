import { detectType } from '@nautink/visual-core/detect';
import { lazy } from 'react';

import type { VisualEditorComponent } from './editor-props.ts';
import type { DetectedType } from '@nautink/visual-core/detect';
import type { EditorId } from '@nautink/visual-core/editor-contract';
import type { LazyExoticComponent } from 'react';

/** An editor component that loads its own chunk the first time it renders. */
export type LazyVisualEditor = LazyExoticComponent<VisualEditorComponent>;

export type EditorRegistry = Readonly<Partial<Record<EditorId, LazyVisualEditor>>>;

/** Wraps a dynamic import of an editor, so every editor (and React Flow) stays out of the main bundle. */
export function lazyEditor(load: () => Promise<VisualEditorComponent>): LazyVisualEditor {
  return lazy(async () => ({ default: await load() }));
}

/**
 * The visual editors the app has, by editor id. Adding an editor is one line here plus its folder
 * (`./<id>/`); see this folder's README. A type without a line shows "No visual editor" in Edit.
 */
export const VISUAL_EDITORS: EditorRegistry = {
  flow: lazyEditor(async () => (await import('./flow/flow-editor.tsx')).FlowEditor),
  er: lazyEditor(async () => (await import('./er/er-editor.tsx')).ErEditor),
  state: lazyEditor(async () => (await import('./state/state-editor.tsx')).StateEditor),
};

/** The editor id for `code` when the app has that editor, else null. */
export function editorIdFor(
  code: string,
  editors: EditorRegistry = VISUAL_EDITORS,
): EditorId | null {
  const detected: DetectedType = detectType(code);
  return detected.editor !== null && editors[detected.editor] !== undefined
    ? detected.editor
    : null;
}
