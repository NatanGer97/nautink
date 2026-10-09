import { numberOr } from '../shared/values.ts';

import type { Size } from '@nautink/visual-core/geometry';

// Content-based node sizes, shared by the shape renderer and dagre so both agree on every box.
const CHAR_W: number = 7.4;
const LINE_H: number = 18;
const ICON_DEFAULT: number = 48;
const ICON_MIN_W: number = 40;
const ICON_TEXT_PAD: number = 8;
const ICON_LABEL_PAD: number = 6;
const TEXT_PAD_X: number = 36;
const TEXT_PAD_Y: number = 24;
const MIN_W: number = 90;
const MAX_W: number = 280;
const MIN_H: number = 44;
const CIRCLE_SCALE: number = 0.9;
const CIRCLE_MIN: number = 64;
const PERSON_MIN_W: number = 80;
const PERSON_HEAD: number = 34;

/** Shapes that never show their label (Mermaid ignores it too). */
export const NO_LABEL: ReadonlySet<string> = new Set([
  'sm-circ',
  'f-circ',
  'fr-circ',
  'fork',
  'cross-circ',
  'bolt',
]);

/** Shapes with a fixed size, whatever their label. */
export const FIXED: ReadonlyMap<string, Size> = new Map(
  Object.entries({
    'sm-circ': { width: 22, height: 22 },
    'f-circ': { width: 18, height: 18 },
    'fr-circ': { width: 26, height: 26 },
    'cross-circ': { width: 40, height: 40 },
    fork: { width: 90, height: 12 },
    bolt: { width: 40, height: 60 },
  }),
);

/** What sizing reads from a node: its shape and label, plus the asset fields of icon/image nodes. */
export interface NodeSizeInput {
  shape: string;
  label: string;
  icon?: string;
  img?: string;
  w?: number | null;
  h?: number | null;
}

type Adjust = (box: Size) => Size;

interface ScaleRule {
  widthScale: number;
  minWidth: number;
  heightScale: number;
  minHeight: number;
}

const grow =
  (more: Size): Adjust =>
  (box: Size): Size => ({ width: box.width + more.width, height: box.height + more.height });

const scaleAtLeast =
  (rule: ScaleRule): Adjust =>
  (box: Size): Size => ({
    width: Math.max(box.width * rule.widthScale, rule.minWidth),
    height: Math.max(box.height * rule.heightScale, rule.minHeight),
  });

const CIRCLE: Adjust = (box: Size): Size => {
  const side: number = Math.max(box.width * CIRCLE_SCALE, box.height, CIRCLE_MIN);
  return { width: side, height: side };
};

const PERSON: Adjust = (box: Size): Size => ({
  width: Math.max(box.width, PERSON_MIN_W),
  height: box.height + PERSON_HEAD,
});

const RULES: readonly (readonly [readonly string[], Adjust])[] = [
  [['diam'], scaleAtLeast({ widthScale: 1.45, minWidth: 110, heightScale: 1.6, minHeight: 72 })],
  [['circle', 'dbl-circ'], CIRCLE],
  [
    ['tri', 'flip-tri'],
    scaleAtLeast({ widthScale: 1.6, minWidth: 100, heightScale: 1.7, minHeight: 70 }),
  ],
  [['cloud', 'bang'], grow({ width: 40, height: 28 })],
  [['person'], PERSON],
  [
    ['hex', 'lean-r', 'lean-l', 'trap-b', 'trap-t', 'curv-trap', 'notch-pent'],
    grow({ width: 28, height: 0 }),
  ],
  [['cyl', 'lin-cyl', 'bucket'], grow({ width: 0, height: 16 })],
  [['doc', 'lin-doc', 'tag-doc', 'flag'], grow({ width: 0, height: 12 })],
  [['docs', 'st-rect'], grow({ width: 8, height: 14 })],
  [['browser', 'console', 'folder', 'win-pane', 'div-rect'], grow({ width: 0, height: 14 })],
  [['brace', 'brace-r', 'braces'], grow({ width: 10, height: 0 })],
];

const ADJUST: ReadonlyMap<string, Adjust> = new Map(
  RULES.flatMap(([ids, adjust]) => ids.map((id: string): [string, Adjust] => [id, adjust])),
);

/** A label's lines: `<br>` and newlines both break. */
export function labelLines(label: string): string[] {
  return label.split(/<br\s*\/?>|\n/i);
}

function assetSize(node: NodeSizeInput): Size {
  const box: number = numberOr(node.h, ICON_DEFAULT);
  const width: number = node.img ? numberOr(node.w, box) : box;
  const lines: string[] = node.label ? labelLines(node.label) : [];
  const textWidth: number = Math.max(0, ...lines.map((line: string) => line.length * CHAR_W));
  const labelHeight: number = lines.length ? lines.length * LINE_H + ICON_LABEL_PAD : 0;
  return {
    width: Math.round(Math.max(width, textWidth + ICON_TEXT_PAD, ICON_MIN_W)),
    height: Math.round(box + labelHeight),
  };
}

function textBox(label: string): Size {
  const lines: string[] = labelLines(label);
  const longest: number = Math.max(...lines.map((line: string) => line.length), 1);
  return {
    width: Math.min(Math.max(longest * CHAR_W + TEXT_PAD_X, MIN_W), MAX_W),
    height: Math.max(lines.length * LINE_H + TEXT_PAD_Y, MIN_H),
  };
}

/** Canvas size of a node, from its shape and label (icon and image nodes from their asset size). */
export function nodeSize(node: NodeSizeInput): Size {
  if (node.icon || node.img) {
    return assetSize(node);
  }
  const fixed: Size | undefined = FIXED.get(node.shape);
  if (fixed) {
    return { ...fixed };
  }
  const box: Size = textBox(node.label);
  const adjusted: Size = ADJUST.get(node.shape)?.(box) ?? box;
  return { width: Math.round(adjusted.width), height: Math.round(adjusted.height) };
}
