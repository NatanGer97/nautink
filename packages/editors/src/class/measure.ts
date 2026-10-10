// Content-based sizes for class canvas items, shared by the node renderers and dagre layout so
// both agree on every box. Text is measured by an injected measurer (a canvas in the browser).
import { attrDisplay, generics, methodDisplay, noteLines, readable } from './text.ts';

import type { ClassAttr, ClassItem, ClassMethod, ClassNote } from './types.ts';
import type { Size } from '@nautink/visual-core/geometry';
import type { TextMeasurer } from '@nautink/visual-core/text-measure';

// The app's fonts (PRD §6.2): Geist for names and notes, Geist Mono for members (M3).
const SANS: string = "Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
const MONO: string = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

/** The CSS fonts the class renderer uses; measure text in these. */
export const FONT: Readonly<Record<'name' | 'member' | 'stereo' | 'note', string>> = {
  name: `600 13px ${SANS}`,
  member: `12px ${MONO}`,
  stereo: `11px ${SANS}`,
  note: `12px ${SANS}`,
};

/** Member row height. */
export const ROW: number = 18;
export const STEREO_ROW: number = 15;
export const NAME_ROW: number = 19;
/** Top and bottom padding of the header, each. */
export const HEAD_PAD: number = 6;
/** Top and bottom padding of a member compartment, each. */
export const SECTION_PAD: number = 4;
export const EMPTY_SECTION: number = 8;
/** Width of the visibility column. */
export const VIS_W: number = 13;
export const SIDE_PAD: number = 10;
export const MIN_W: number = 120;
export const MAX_W: number = 460;
export const LOLLI_SIZE: Size = { width: 22, height: 22 };

// +2 for the outer border, +2 for the two compartment separators.
const BORDERS: number = 4;
const BOTH_SIDES: number = 2;
const NOTE_PAD_X: number = 36;
const NOTE_MIN_TEXT: number = 30;
const NOTE_MIN_W: number = 90;
const NOTE_MAX_W: number = 320;
const NOTE_LINE_H: number = 17;
const NOTE_PAD_Y: number = 20;

/** The class name as the canvas shows it, generics included: `List<T>`. */
export function className(item: ClassItem): string {
  const name: string = readable(item.label || item.id);
  return item.generic ? `${name}<${generics(readable(item.generic))}>` : name;
}

function sectionHeight(rows: number): number {
  return rows ? rows * ROW + SECTION_PAD * BOTH_SIDES : EMPTY_SECTION;
}

function contentWidths(item: ClassItem, measure: TextMeasurer): number[] {
  const memberWidth = (text: string): number => VIS_W + measure(text, FONT.member);
  return [
    measure(className(item), FONT.name),
    ...item.annotations.map((annotation: string) =>
      measure(`«${readable(annotation)}»`, FONT.stereo),
    ),
    ...item.attrs.map((attr: ClassAttr) => memberWidth(attrDisplay(attr))),
    ...item.methods.map((method: ClassMethod) => memberWidth(methodDisplay(method))),
  ];
}

/** Size of a class box: widest line plus padding, rows for the header and both compartments. */
export function classSize(item: ClassItem, measure: TextMeasurer): Size {
  const widest: number = Math.ceil(Math.max(...contentWidths(item, measure)));
  const width: number = Math.min(Math.max(widest + SIDE_PAD * BOTH_SIDES + BORDERS, MIN_W), MAX_W);
  const head: number = HEAD_PAD * BOTH_SIDES + NAME_ROW + item.annotations.length * STEREO_ROW;
  const height: number =
    head + sectionHeight(item.attrs.length) + sectionHeight(item.methods.length) + BORDERS;
  return { width, height };
}

/** Size of a note box. */
export function noteSize(note: ClassNote, measure: TextMeasurer): Size {
  const lines: string[] = noteLines(note.text);
  const widest: number = Math.max(
    ...lines.map((line: string) => measure(line, FONT.note)),
    NOTE_MIN_TEXT,
  );
  return {
    width: Math.round(Math.min(Math.max(widest + NOTE_PAD_X, NOTE_MIN_W), NOTE_MAX_W)),
    height: lines.length * NOTE_LINE_H + NOTE_PAD_Y,
  };
}
