// Where the canvas draws things, from the layout (v1's SequenceEditor and shapes.jsx geometry).
import { HEAD_H, ICON_KINDS } from '@nautink/editors/sequence/layout';

import type { Column, Row, SequenceLayout } from '@nautink/editors/sequence/layout';

const HALF: number = 0.5;
const FOOT_GAP: number = 8;
const SELF_W: number = 34;
const SELF_H: number = 20;
const SELF_BACK: number = 2;
const NOTE_FOLD: number = 8;
const TAB_H: number = 13;
const TAB_FOLD: number = 7;
const TAB_BOTTOM: number = 20;
const HIT_PAD: number = 8;
const LABEL_LINE_H: number = 16;
const ICON_LABEL_UP: number = 9;
const DATABASE_LABEL: number = 27;
const COLLECTIONS_LABEL: number = 26;
const COLLECTIONS_SHIFT: number = 3;
const QUEUE_SHIFT: number = 4;

/** The top of a participant's header glyph: created participants start at their creating message. */
export function headerTop(layout: SequenceLayout, col: Column): number {
  return col.p.isCreated ? col.y : layout.top + (layout.headH - HEAD_H[col.p.kind]);
}

/** The top of a participant's footer glyph, under the last row. */
export function footerTop(layout: SequenceLayout): number {
  return layout.end + FOOT_GAP;
}

/** Where a header's label sits: under icon glyphs, inside boxes (v1's `Header`). */
export function headerLabel(col: Column, top: number): { x: number; y: number } {
  const kind: Column['p']['kind'] = col.p.kind;
  if (ICON_KINDS.has(kind)) {
    return { x: col.x, y: top + HEAD_H[kind] - ICON_LABEL_UP };
  }
  if (kind === 'database') {
    return { x: col.x, y: top + DATABASE_LABEL };
  }
  if (kind === 'collections') {
    return { x: col.x - COLLECTIONS_SHIFT, y: top + COLLECTIONS_LABEL };
  }
  return { x: kind === 'queue' ? col.x - QUEUE_SHIFT : col.x, y: top + HEAD_H[kind] * HALF };
}

/** A self message's loop, out to the right and back. */
export function selfPath(x: number, y: number): string {
  return `M${String(x)},${String(y)} H${String(x + SELF_W)} V${String(y + SELF_H)} H${String(x + SELF_BACK)}`;
}

/** The click area of a message: its line and its label above it. */
export function messageHitPath(row: Row & { ay: number; x1: number; x2: number }): string {
  const lines: number = row.labelLines ?? 0;
  const top: number = row.ay - Math.max(HIT_PAD, lines * LABEL_LINE_H);
  return `M${String(row.x1)},${String(top)} H${String(row.x2)} V${String(row.ay + HIT_PAD)} H${String(row.x1)} Z`;
}

/** A note with its folded corner. */
export function notePath(box: { x1: number; x2: number; y: number; h: number }): string {
  const { x1, x2, y, h } = box;
  return `M${String(x1)},${String(y)} H${String(x2 - NOTE_FOLD)} L${String(x2)},${String(y + NOTE_FOLD)} V${String(y + h)} H${String(x1)} Z`;
}

/** A block's name tab in its top-left corner. */
export function tabPath(x1: number, y1: number, tabW: number): string {
  return `M${String(x1)},${String(y1)} H${String(x1 + tabW)} V${String(y1 + TAB_H)} L${String(x1 + tabW - TAB_FOLD)},${String(y1 + TAB_BOTTOM)} H${String(x1)} Z`;
}

/** The arrow's start when a sequence number sits on it: just past the number's circle. */
export function arrowStart(row: { x1: number; x2: number; num?: number }): number {
  const direction: number = row.x2 >= row.x1 ? 1 : -1;
  return row.num === undefined ? row.x1 : row.x1 + direction * HIT_PAD;
}
