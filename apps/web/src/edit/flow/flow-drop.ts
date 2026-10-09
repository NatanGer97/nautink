import type { NewShape } from './flow-actions.ts';

/** The drag type of a shape tile; its data is the shape id ("diam"). */
export const SHAPE_DRAG_TYPE: string = 'application/x-nautink-shape';

/** What a dragged flowchart icon carries: its name and the frame picked in the library. */
export function iconDragData(icon: string, form: string): string {
  return JSON.stringify({ icon, form });
}

function isIconSpec(value: unknown): value is { icon: string; form: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'icon') === 'string' &&
    typeof Reflect.get(value, 'form') === 'string'
  );
}

/** Reads an icon drop: the library's JSON, or a bare name from another icon tile. */
export function parseIconDrop(data: string): NewShape | null {
  try {
    const value: unknown = JSON.parse(data);
    return isIconSpec(value) ? { icon: value.icon, form: value.form } : null;
  } catch {
    return data.includes(':') ? { icon: data, form: 'square' } : null;
  }
}
