// The outlines of the 53 flowchart shapes, ported from v1's `flow/shapes.jsx` as path templates
// (`shape-template.ts`). Every outline sits inside its w × h box with a 1 px inset, so a 1.5 px
// stroke is never clipped.
import { fillTemplate } from './shape-template.ts';

import type { TemplateVars } from './shape-template.ts';

/** How a part is painted: the node outline, a stroke-only decoration, or a filled detail. */
export type ShapeRole = 'outline' | 'deco' | 'decoFill' | 'solid' | 'open' | 'ghost' | 'bare';

export interface ShapePart {
  d: string;
  role: ShapeRole;
  /** Drawn in a smaller box: "x y shrink-width shrink-height" (stacked documents and processes). */
  frame?: string;
}

/** A filled-in part, ready for a <path>. */
export interface DrawnPart {
  d: string;
  role: ShapeRole;
  dx: number;
  dy: number;
}

const SLANT_SHARE: number = 0.35;
const SLANT_MAX: number = 18;
const HEAD_MAX: number = 14;
const HEAD_SHARE: number = 0.2;
const CAP_MAX: number = 12;
const CAP_DIVISOR: number = 6;
const HALF: number = 0.5;
const STAR_POINTS: number = 20;
const EVERY_OTHER: number = 2;
const STAR_INNER: number = 0.72;
const PRECISION: number = 4;

/** Every variable a template can use, for a w × h box. */
export function shapeVars(w: number, h: number): TemplateVars {
  const hw: number = w * HALF;
  const radius: number = hw - 1;
  return {
    w,
    h,
    hw,
    hh: h * HALF,
    s: Math.min(h * SLANT_SHARE, SLANT_MAX),
    pr: Math.min(HEAD_MAX, w * HEAD_SHARE),
    hr: Math.min(CAP_MAX, w / CAP_DIVISOR),
    cd: radius * Math.SQRT1_2,
  };
}

/** A rectangle with corner radius `r` (a template expression). */
function rect(r: string): string {
  return [
    `M{${r}+1},1 H{w-${r}-1} A{${r}},{${r}} 0 0 1 {w-1},{${r}+1} V{h-${r}-1}`,
    `A{${r}},{${r}} 0 0 1 {w-${r}-1},{h-1} H{${r}+1} A{${r}},{${r}} 0 0 1 1,{h-${r}-1}`,
    `V{${r}+1} A{${r}},{${r}} 0 0 1 {${r}+1},1 Z`,
  ].join(' ');
}

/** An ellipse from "cx cy rx ry" (each a template expression). */
function ellipse(spec: string): string {
  const [cx = '', cy = '', rx = '', ry = ''] = spec.split(' ');
  return `M{${cx}-${rx}},{${cy}} A{${rx}},{${ry}} 0 1 0 {${cx}+${rx}},{${cy}} A{${rx}},{${ry}} 0 1 0 {${cx}-${rx}},{${cy}} Z`;
}

/** A polygon from "x,y x,y …" (no spaces inside a hole). */
function polygon(points: string): string {
  return `M${points.split(' ').join(' L')} Z`;
}

function format(value: number): string {
  return String(Number(value.toFixed(PRECISION)));
}

/** A star (Mermaid's "bang"): each point is `a·w + b`, so it stays a template. */
function star(): string {
  const points: string[] = [...Array.from({ length: STAR_POINTS }).keys()].map((i: number) => {
    const radius: number = i % EVERY_OTHER === 1 ? STAR_INNER : 1;
    const angle: number = (Math.PI * EVERY_OTHER * i) / STAR_POINTS - Math.PI * HALF;
    const cos: number = Math.cos(angle) * radius;
    const sin: number = Math.sin(angle) * radius;
    return `{${format(HALF + cos * HALF)}w+${format(-cos)}},{${format(HALF + sin * HALF)}h+${format(-sin)}}`;
  });
  return polygon(points.join(' ').replace(/\+-/g, '-'));
}

const outline = (d: string, frame?: string): ShapePart => ({
  d,
  role: 'outline',
  ...(frame === undefined ? {} : { frame }),
});
const deco = (d: string): ShapePart => ({ d, role: 'deco' });

const RECT: string = rect('2');
const DOC: string = 'M1,1 H{w-1} V{h-10} Q{0.75w},{h-22} {hw},{h-10} T1,{h-10} Z';
const CYLINDER: string =
  'M1,8 a{hw-1},8 0 0,0 {w-2},0 a{hw-1},8 0 0,0 {2-w},0 v{h-17} a{hw-1},8 0 0,0 {w-2},0 v{17-h}';
const BRACE_LEFT: string =
  'M14,1 Q6,1 6,10 V{hh-6} Q6,{hh} 1,{hh} Q6,{hh} 6,{hh+6} V{h-10} Q6,{h-1} 14,{h-1}';
const BRACE_RIGHT: string =
  'M{w-14},1 Q{w-6},1 {w-6},10 V{hh-6} Q{w-6},{hh} {w-1},{hh} Q{w-6},{hh} {w-6},{hh+6} V{h-10} Q{w-6},{h-1} {w-14},{h-1}';
const CIRCLE: string = ellipse('hw hh hw-1 hh-1');

const BASIC: Readonly<Record<string, readonly ShapePart[]>> = {
  rect: [outline(RECT)],
  rounded: [outline(rect('10'))],
  stadium: [outline(rect('hh-1'))],
  diam: [outline(polygon('{hw},1 {w-1},{hh} {hw},{h-1} 1,{hh}'))],
  circle: [outline(CIRCLE)],
  'dbl-circ': [outline(CIRCLE), deco(ellipse('hw hh hw-6 hh-6'))],
  hex: [outline(polygon('{s+1},1 {w-s-1},1 {w-1},{hh} {w-s-1},{h-1} {s+1},{h-1} 1,{hh}'))],
  tri: [outline(polygon('{hw},1 {w-1},{h-1} 1,{h-1}'))],
  'flip-tri': [outline(polygon('1,1 {w-1},1 {hw},{h-1}'))],
  text: [{ d: RECT, role: 'ghost' }],
};

const FLOWCHART: Readonly<Record<string, readonly ShapePart[]>> = {
  'fr-rect': [outline(RECT), deco('M9,1 V{h-1} M{w-9},1 V{h-1}')],
  'lean-r': [outline(polygon('{s+1},1 {w-1},1 {w-s-1},{h-1} 1,{h-1}'))],
  'lean-l': [outline(polygon('1,1 {w-s-1},1 {w-1},{h-1} {s+1},{h-1}'))],
  'trap-b': [outline(polygon('{s+1},1 {w-s-1},1 {w-1},{h-1} 1,{h-1}'))],
  'trap-t': [outline(polygon('1,1 {w-1},1 {w-s-1},{h-1} {s+1},{h-1}'))],
  'sl-rect': [outline(polygon('1,{0.3h} {w-1},1 {w-1},{h-1} 1,{h-1}'))],
  doc: [outline(DOC)],
  docs: [outline(DOC, '8 0 8 8'), outline(DOC, '4 4 8 8'), outline(DOC, '0 8 8 8')],
  'lin-doc': [outline(DOC), deco('M9,1 V{h-12}')],
  'tag-doc': [
    outline(DOC),
    { d: polygon('{w-1},{h-30} {w-1},{h-14} {w-17},{h-14}'), role: 'decoFill' },
  ],
  delay: [outline('M1,1 H{w-hh} A{hh-1},{hh-1} 0 0,1 {w-hh},{h-1} H1 Z')],
  'st-rect': [outline(RECT, '8 0 8 8'), outline(RECT, '4 4 8 8'), outline(RECT, '0 8 8 8')],
  'div-rect': [outline(RECT), deco('M1,{0.25h} H{w-1}')],
  'lin-rect': [outline(RECT), deco('M9,1 V{h-1}')],
  'tag-rect': [
    outline(RECT),
    { d: polygon('{w-1},{h-17} {w-1},{h-1} {w-17},{h-1}'), role: 'decoFill' },
  ],
  'notch-rect': [outline(polygon('12,1 {w-1},1 {w-1},{h-1} 1,{h-1} 1,12'))],
  'notch-pent': [outline(polygon('12,1 {w-12},1 {w-1},12 {w-1},{h-1} 1,{h-1} 1,12'))],
  'curv-trap': [outline('M16,1 H{w-hh} A{hh-1},{hh-1} 0 0,1 {w-hh},{h-1} H16 L1,{hh} Z')],
  flag: [outline('M1,9 Q{0.25w},-3 {hw},9 T{w-1},9 V{h-9} Q{0.75w},{h+3} {hw},{h-9} T1,{h-9} Z')],
  odd: [outline(polygon('1,1 {w-1},1 {w-1},{h-1} 1,{h-1} {s+1},{hh}'))],
  hourglass: [outline('M1,1 H{w-1} L1,{h-1} H{w-1} Z')],
};

const DATA: Readonly<Record<string, readonly ShapePart[]>> = {
  cyl: [outline(CYLINDER)],
  'lin-cyl': [outline(CYLINDER), deco('M1,16 a{hw-1},8 0 0,0 {w-2},0')],
  'h-cyl': [
    outline('M{hr+1},1 H{w-hr-1} a{hr},{hh-1} 0 0,1 0,{h-2} H{hr+1} a{hr},{hh-1} 0 0,1 0,{2-h} Z'),
    deco('M{w-hr-1},1 a{hr},{hh-1} 0 0,0 0,{h-2}'),
  ],
  datastore: [{ d: 'M1,1 H{w-1} V{h-1} H1 Z', role: 'bare' }, deco('M1,1 H{w-1} M1,{h-1} H{w-1}')],
  'bow-rect': [outline('M11,1 H{w-1} A10,{hh-1} 0 0,0 {w-1},{h-1} H11 A10,{hh-1} 0 0,1 11,1 Z')],
  'win-pane': [outline(RECT), deco('M11,1 V{h-1} M1,11 H{w-1}')],
  bucket: [
    outline('M1,9 L8,{h-6} Q{hw},{h+3} {w-8},{h-6} L{w-1},9'),
    outline(ellipse('hw 9 hw-1 8')),
  ],
  folder: [outline('M1,3 Q1,1 3,1 H{0.36w} L{0.44w},12 H{w-1} V{h-1} H1 Z')],
};

const SYSTEMS: Readonly<Record<string, readonly ShapePart[]>> = {
  person: [outline(ellipse('hw pr+1 pr pr')), outline(rect('8'), '0 {2pr+4} 0 {2pr+4}')],
  cloud: [
    outline(
      'M{0.24w},{h-2} C{0.04w},{h-2} {0.02w},{0.58h} {0.16w},{0.5h} C{0.1w},{0.2h} {0.38w},{0.08h} {0.48w},{0.24h} C{0.58w},{0.02h} {0.86w},{0.1h} {0.84w},{0.38h} C{w},{0.42h} {w},{h-2} {0.78w},{h-2} Z',
    ),
  ],
  browser: [
    outline(rect('5')),
    deco('M1,16 H{w-1}'),
    deco(ellipse('9 8.5 2.5 2.5')),
    deco(ellipse('17 8.5 2.5 2.5')),
    deco(ellipse('25 8.5 2.5 2.5')),
  ],
  console: [outline(rect('5')), deco('M1,16 H{w-1} M8,{h-16} l5,4 l-5,4 M16,{h-8} h8')],
  bolt: [
    outline(
      polygon(
        '{0.62w},1 {0.1w},{0.56h} {0.46w},{0.56h} {0.34w},{h-1} {0.9w},{0.42h} {0.54w},{0.42h} {0.74w},1',
      ),
    ),
  ],
  bang: [outline(star())],
};

const CONTROL: Readonly<Record<string, readonly ShapePart[]>> = {
  'sm-circ': [{ d: ellipse('hw hh hw-1 hw-1'), role: 'solid' }],
  'f-circ': [{ d: ellipse('hw hh hw-1 hw-1'), role: 'solid' }],
  'fr-circ': [
    outline(ellipse('hw hh hw-1 hw-1')),
    { d: ellipse('hw hh hw-6 hw-6'), role: 'solid' },
  ],
  'cross-circ': [
    outline(ellipse('hw hh hw-1 hw-1')),
    deco('M{hw-cd},{hh-cd} L{hw+cd},{hh+cd} M{hw+cd},{hh-cd} L{hw-cd},{hh+cd}'),
  ],
  fork: [{ d: RECT, role: 'solid' }],
  brace: [{ d: BRACE_LEFT, role: 'open' }],
  'brace-r': [{ d: BRACE_RIGHT, role: 'open' }],
  braces: [
    { d: BRACE_LEFT, role: 'open' },
    { d: BRACE_RIGHT, role: 'open' },
  ],
};

/** Every shape's parts, by Mermaid's short shape name. */
export const SHAPE_PARTS: Readonly<Record<string, readonly ShapePart[]>> = {
  ...BASIC,
  ...FLOWCHART,
  ...DATA,
  ...SYSTEMS,
  ...CONTROL,
};

const FALLBACK: readonly ShapePart[] = [outline(RECT)];

function frameOf(frame: string | undefined, vars: TemplateVars): [number, number, number, number] {
  const [dx = 0, dy = 0, dw = 0, dh = 0] = (frame ?? '0 0 0 0')
    .split(' ')
    .map((part: string) => Number(fillTemplate(part, vars)));
  return [dx, dy, dw, dh];
}

function drawPart(part: ShapePart, vars: TemplateVars): DrawnPart {
  const [dx, dy, dw, dh] = frameOf(part.frame, vars);
  const w: number = Number(vars.w) - dw;
  const h: number = Number(vars.h) - dh;
  const inner: TemplateVars = { ...vars, w, h, hw: w * HALF, hh: h * HALF };
  return { d: fillTemplate(part.d, inner), role: part.role, dx, dy };
}

/** The shape's parts drawn for a w × h box. An unknown shape is drawn as a process box. */
export function drawShape(shape: string, w: number, h: number): DrawnPart[] {
  const vars: TemplateVars = shapeVars(w, h);
  const parts: readonly ShapePart[] = Object.hasOwn(SHAPE_PARTS, shape)
    ? (SHAPE_PARTS[shape] ?? FALLBACK)
    : FALLBACK;
  return parts.map((part: ShapePart) => drawPart(part, vars));
}
