import type { DragPreview } from './sequence-drag.ts';
import type { EditTarget, SelectionKind, SequenceSelection } from './sequence-types.ts';
import type { Column, SequenceLayout } from '@nautink/editors/sequence/layout';
import type { PointerEvent } from 'react';

/** Everything the drawing needs: the layout, the selection, a drag in progress, the edited text. */
export interface CanvasScene {
  layout: SequenceLayout;
  selection: SequenceSelection;
  preview: DragPreview | null;
  editing: EditTarget | null;
  isReadOnly: boolean;
  /** Prefix for the arrow marker ids, unique per canvas. */
  markerId: string;
}

/** What presses on the drawing do. */
export interface CanvasHandlers {
  onHeadDown: (event: PointerEvent<SVGElement>, id: string) => void;
  onLifeDown: (event: PointerEvent<SVGElement>, col: Column) => void;
  onItemDown: (event: PointerEvent<SVGElement>, id: string) => void;
  onBoxDown: (event: PointerEvent<SVGElement>, id: string) => void;
  onEdit: (target: EditTarget) => void;
}

export function isSelected(scene: CanvasScene, kind: SelectionKind, id: string): boolean {
  return scene.selection.kind === kind && scene.selection.ids.includes(id);
}

/** True while `target`'s text is open in the inline field (the canvas hides it then). */
export function isEditing(scene: CanvasScene, target: EditTarget): boolean {
  const editing: EditTarget | null = scene.editing;
  const isSame: boolean = editing?.kind === target.kind && editing.id === target.id;
  if (editing?.kind === 'section' && target.kind === 'section') {
    return isSame && editing.sectionIndex === target.sectionIndex;
  }
  return isSame;
}

/** How far a dragged row is drawn from its place, or 0 when it is not being dragged. */
export function dragOffset(scene: CanvasScene, id: string): number {
  const preview: DragPreview | null = scene.preview;
  return preview?.mode === 'item' && preview.ids.includes(id) ? preview.dy : 0;
}

/** How far a dragged column is drawn from its place, or 0. */
export function columnOffset(scene: CanvasScene, id: string): number {
  const preview: DragPreview | null = scene.preview;
  return preview?.mode === 'col' && preview.id === id ? preview.dx : 0;
}
