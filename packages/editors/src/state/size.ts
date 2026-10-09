// Sizes of state canvas leaves, from their render data. Shared by the node renderers and layout.
import type { NoteSide } from './types.ts';
import type { Size } from '@nautink/visual-core/geometry';

/** What the canvas draws for one leaf. `isHorizontal`: fork/join bars lie flat (TB/BT layouts). */
export type LeafData =
  | { kind: 'state'; label: string; desc: string[] }
  | { kind: 'emptyComposite'; label: string }
  | { kind: 'choice' | 'fork' | 'join'; isHorizontal: boolean; title: string }
  | { kind: 'start' | 'end'; isLoose: boolean; title: string }
  | { kind: 'note'; text: string; target: string; side: NoteSide };

export type LeafKind = LeafData['kind'];

/** Toolbar items of the state editor. */
export const PALETTE: readonly { kind: string; name: string }[] = [
  { kind: 'state', name: 'State' },
  { kind: 'start', name: 'Start [*]' },
  { kind: 'end', name: 'End [*]' },
  { kind: 'choice', name: 'Choice' },
  { kind: 'fork', name: 'Fork' },
  { kind: 'join', name: 'Join' },
  { kind: 'composite', name: 'Composite state' },
  { kind: 'note', name: 'Note' },
];

const CHAR_W: number = 7.4;
const SMALL_W: number = 6.6;
const FIXED: Readonly<Record<'start' | 'end' | 'choice', Size>> = {
  start: { width: 22, height: 22 },
  end: { width: 26, height: 26 },
  choice: { width: 34, height: 34 },
};
const BAR: Size = { width: 90, height: 10 };
const COMPOSITE_MIN_W: number = 170;
const COMPOSITE_PAD: number = 40;
const COMPOSITE_H: number = 80;
const NOTE_PAD: number = 26;
const NOTE_MIN_W: number = 80;
const NOTE_MAX_W: number = 240;
const NOTE_TEXT_PAD: number = 22;
const NOTE_ROW: number = 16;
const STATE_PAD: number = 34;
const STATE_MIN_W: number = 96;
const STATE_MAX_W: number = 280;
const TITLE_PAD: number = 28;
const DESC_PAD: number = 24;
const TITLE_ROW: number = 18;
const TITLE_EXTRA: number = 22;
const STATE_MIN_H: number = 40;
const DESC_EXTRA: number = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

interface WrapRequest {
  line: string;
  charWidth: number;
  width: number;
}

function wrapCount({ line, charWidth, width }: WrapRequest): number {
  return Math.max(1, Math.ceil((line.length * charWidth) / width));
}

function noteSize(text: string): Size {
  const lines: string[] = (text || ' ').split('\n');
  const width: number = clamp(
    Math.max(...lines.map((line: string) => line.length)) * SMALL_W + NOTE_PAD,
    NOTE_MIN_W,
    NOTE_MAX_W,
  );
  const rows: number = lines.reduce(
    (total: number, line: string) =>
      total + wrapCount({ line, charWidth: SMALL_W, width: width - NOTE_TEXT_PAD }),
    0,
  );
  return { width: Math.round(width), height: rows * NOTE_ROW + NOTE_ROW };
}

function stateSize(label: string, desc: readonly string[]): Size {
  const longest: number = Math.max(
    label.length * CHAR_W,
    ...desc.map((line: string) => line.length * SMALL_W),
    1,
  );
  const width: number = clamp(longest + STATE_PAD, STATE_MIN_W, STATE_MAX_W);
  const titleRows: number = wrapCount({ line: label, charWidth: CHAR_W, width: width - TITLE_PAD });
  const descRows: number = desc.reduce(
    (total: number, line: string) =>
      total + wrapCount({ line, charWidth: SMALL_W, width: width - DESC_PAD }),
    0,
  );
  const height: number =
    Math.max(STATE_MIN_H, titleRows * TITLE_ROW + TITLE_EXTRA) +
    (descRows ? descRows * NOTE_ROW + DESC_EXTRA : 0);
  return { width: Math.round(width), height: Math.round(height) };
}

/** Size of a leaf node from its render data. */
export function nodeSize(data: LeafData): Size {
  switch (data.kind) {
    case 'start':
    case 'end':
    case 'choice':
      return { ...FIXED[data.kind] };
    case 'fork':
    case 'join':
      return data.isHorizontal ? { ...BAR } : { width: BAR.height, height: BAR.width };
    case 'emptyComposite':
      return {
        width: Math.max(COMPOSITE_MIN_W, data.label.length * CHAR_W + COMPOSITE_PAD),
        height: COMPOSITE_H,
      };
    case 'note':
      return noteSize(data.text);
    default:
      return stateSize(data.label, data.desc);
  }
}
