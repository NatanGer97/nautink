import { useEffect, useState } from 'react';

const DRAG_EVENTS: readonly string[] = ['dragenter', 'dragover', 'dragleave', 'drop'];

/** True when a drag carries files (not text or a link dragged inside the page). */
function hasFiles(event: DragEvent): boolean {
  return [...(event.dataTransfer?.types ?? [])].includes('Files');
}

/** Follows a file drag over the window: enter and leave fire per element, so it counts depth. */
class FileDragTracker {
  private depth: number = 0;
  private readonly setDragging: (isDragging: boolean) => void;
  private readonly onDrop: (files: File[]) => void;

  constructor(setDragging: (isDragging: boolean) => void, onDrop: (files: File[]) => void) {
    this.setDragging = setDragging;
    this.onDrop = onDrop;
  }

  readonly handle = (event: Event): void => {
    // Only drag events are registered; jsdom has no DragEvent class to check against.
    const drag: DragEvent = event as DragEvent;
    if (!hasFiles(drag)) {
      return;
    }
    event.preventDefault();
    const transfer: DataTransfer | null = drag.dataTransfer;
    if (event.type === 'dragover' && transfer !== null) {
      transfer.dropEffect = 'copy';
    } else if (event.type !== 'dragover') {
      this.move(event.type, [...(transfer?.files ?? [])]);
    }
  };

  private move(type: string, files: File[]): void {
    this.depth = type === 'dragenter' ? this.depth + 1 : Math.max(0, this.depth - 1);
    if (type === 'drop') {
      this.depth = 0;
      this.onDrop(files);
    }
    this.setDragging(this.depth > 0);
  }
}

/** Files dropped anywhere on the window go to `onDrop`; returns whether a file drag is over it. */
export function useFileDrop(onDrop: (files: File[]) => void): boolean {
  const [isDragging, setDragging] = useState<boolean>(false);
  useEffect(() => {
    const tracker: FileDragTracker = new FileDragTracker(setDragging, onDrop);
    for (const type of DRAG_EVENTS) {
      window.addEventListener(type, tracker.handle, true);
    }
    return (): void => {
      for (const type of DRAG_EVENTS) {
        window.removeEventListener(type, tracker.handle, true);
      }
    };
  }, [onDrop]);
  return isDragging;
}
