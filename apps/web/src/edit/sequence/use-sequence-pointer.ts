import { useEffect, useEffectEvent, useState } from 'react';

import { CanvasPress } from './canvas-press.ts';
import { dragOutcome, dragPreview } from './sequence-drag.ts';
import { applyDragOutcome } from './sequence-outcomes.ts';
import { draggedRows } from './sequence-selection.ts';
import { panBy } from '../../preview/view-math.ts';

import type { SequenceActionContext } from './sequence-actions.ts';
import type { DragPreview, DragScene, DragSession, DragStart } from './sequence-drag.ts';
import type { CanvasHandlers } from './sequence-scene.ts';
import type { SequenceView } from './use-sequence-view.ts';
import type { Point } from '../../preview/view-math.ts';
import type { SequenceLayout } from '@nautink/editors/sequence/layout';
import type { SequenceModel } from '@nautink/editors/sequence/types';
import type { PointerEvent as ReactPointerEvent } from 'react';

export interface PointerInput {
  view: Omit<SequenceView, 'attachViewport'>;
  layout: SequenceLayout | null;
  context: SequenceActionContext;
}

export interface SequencePointer {
  handlers: Omit<CanvasHandlers, 'onEdit'>;
  /** A press on empty canvas: pans when dragged, clears the selection when clicked. */
  onBackgroundDown: (event: ReactPointerEvent<HTMLElement>) => void;
  preview: DragPreview | null;
}

interface PressDeps {
  input: PointerInput;
  press: CanvasPress;
  setPreview: (preview: DragPreview | null) => void;
}

type StartPress = (event: ReactPointerEvent, from: DragStart) => void;

function clientOf(event: { clientX: number; clientY: number }): Point {
  return { x: event.clientX, y: event.clientY };
}

function sceneOf({ context, layout }: PointerInput): DragScene | null {
  const model: SequenceModel | null = context.getModel();
  if (model === null || layout === null) {
    return null;
  }
  return { layout, model, selection: context.getSelection(), isReadOnly: context.isReadOnly() };
}

/** A drag moved: pan the view, or show where the drag would land (never while read-only). */
function movePress({ input, press, setPreview }: PressDeps, event: PointerEvent): void {
  const session: DragSession | null = press.move(clientOf(event));
  if (session?.start.mode === 'pan') {
    const { view } = session.start;
    input.view.setView(
      panBy(view, event.clientX - session.client.x, event.clientY - session.client.y),
    );
    return;
  }
  const scene: DragScene | null = sceneOf(input);
  if (session !== null && scene !== null && !scene.isReadOnly) {
    setPreview(dragPreview(session, input.view.toCanvas(clientOf(event)), scene));
  }
}

function endPress({ input, press, setPreview }: PressDeps, event: PointerEvent): void {
  const session: DragSession | null = press.end();
  const scene: DragScene | null = sceneOf(input);
  setPreview(null);
  if (session !== null && scene !== null) {
    applyDragOutcome(
      input.context,
      dragOutcome(session, input.view.toCanvas(clientOf(event)), scene),
    );
  }
}

function listenOnWindow(
  move: (event: PointerEvent) => void,
  up: (event: PointerEvent) => void,
): () => void {
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  return (): void => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
}

/** Follows the pointer on the window while a press lasts (v1's window listeners). */
function useWindowPointer(deps: PressDeps): void {
  const onMove: (event: PointerEvent) => void = useEffectEvent((event: PointerEvent): void => {
    movePress(deps, event);
  });
  const onUp: (event: PointerEvent) => void = useEffectEvent((event: PointerEvent): void => {
    endPress(deps, event);
  });
  useEffect(
    () =>
      listenOnWindow(
        (event: PointerEvent): void => {
          onMove(event);
        },
        (event: PointerEvent): void => {
          onUp(event);
        },
      ),
    [],
  );
}

function startPress(press: CanvasPress, view: PointerInput['view']): StartPress {
  return (event: ReactPointerEvent, from: DragStart): void => {
    if (event.button === 0) {
      event.stopPropagation();
      press.start(from, view.toCanvas(clientOf(event)), clientOf(event));
    }
  };
}

/** A drag on a row moves the selected neighbours with it, when it is one of them. */
function rowStart(context: SequenceActionContext, id: string, isShift: boolean): DragStart {
  const model: SequenceModel | null = context.getModel();
  const ids: readonly string[] =
    model === null ? [id] : draggedRows(model, context.getSelection(), id);
  return { mode: 'item', id, ids, isShift };
}

function canvasHandlers(
  start: StartPress,
  context: SequenceActionContext,
): SequencePointer['handlers'] {
  return {
    onHeadDown: (event, id): void => {
      start(event, { mode: 'col', id });
    },
    onLifeDown: (event, col): void => {
      start(event, { mode: 'link', from: col.id, x: col.x });
    },
    onItemDown: (event, id): void => {
      start(event, rowStart(context, id, event.shiftKey || event.metaKey));
    },
    onBoxDown: (event, id): void => {
      event.stopPropagation();
      context.select({ kind: 'box', ids: [id] });
    },
  };
}

/**
 * Presses on the canvas (v1's `startDrag`): drag a header to reorder, drag from a lifeline to draw
 * a message, drag rows up or down, drag empty canvas to pan; a press that does not move selects.
 */
export function useSequencePointer(input: PointerInput): SequencePointer {
  const [press] = useState<CanvasPress>(() => new CanvasPress());
  const [preview, setPreview] = useState<DragPreview | null>(null);
  useWindowPointer({ input, press, setPreview });
  const start: StartPress = startPress(press, input.view);
  return {
    preview,
    onBackgroundDown: (event): void => {
      start(event, { mode: 'pan', view: input.view.view });
    },
    handlers: canvasHandlers(start, input.context),
  };
}
