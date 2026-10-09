// Geometry for the sequence canvas, computed from the model: item order decides the layout and
// nothing is stored. Text is measured by an injected measurer (a canvas in the browser).
import { BLOCKS, HEADS } from './constants.ts';
import { displayText } from './text.ts';
import { numberAt, textAt } from '../shared/values.ts';

import type {
  ActivationItem,
  BlockItem,
  HeadKind,
  MessageItem,
  NoteItem,
  Participant,
  ParticipantKind,
  SequenceBox,
  SequenceItem,
  SequenceModel,
} from './types.ts';
import type { TextMeasurer } from '@nautink/visual-core/text-measure';

export const LINE_H: number = 16;
/** The font sequence text is measured in. */
export const FONT: string = '13px system-ui, sans-serif';

/** Header glyph height per kind; icon kinds put the label under the glyph. */
export const HEAD_H: Readonly<Record<ParticipantKind, number>> = {
  participant: 40,
  actor: 62,
  boundary: 54,
  control: 54,
  entity: 54,
  database: 50,
  collections: 46,
  queue: 42,
};
export const ICON_KINDS: ReadonlySet<ParticipantKind> = new Set<ParticipantKind>([
  'actor',
  'boundary',
  'control',
  'entity',
]);

const HALF: number = 0.5;
const MIN_GAP: number = 150;
const EDGE_PAD: number = 30;
const EMPTY_EDGE: number = 40;
const NUMBER_W: number = 22;
const SELF_ROOM: number = 64;
const LABEL_ROOM: number = 40;
const NOTE_ROOM: number = 24;
const NOTE_HALF_ROOM: number = 12;
const DEPTH_INDENT: number = 12;
const TITLE_H: number = 30;
const TITLED_BOXES_H: number = 34;
const BOXES_H: number = 18;
const PLAIN_TOP: number = 14;
const MIN_HEAD: number = 40;
const BODY_GAP: number = 18;
const END_GAP: number = 44;
const FOOT_GAP: number = 24;
const BOX_PAD: number = 10;
const BOX_TOP: number = 4;
const ICON_MIN_W: number = 64;
const ICON_PAD: number = 12;
const BOX_MIN_W: number = 92;
const QUEUE_EXTRA: number = 14;
const NOTE_MIN_W: number = 80;
const NOTE_PAD: number = 22;
const BAR_HALF: number = 5;
const BAR_W: number = 10;
const SLOT_DEPTH_WEIGHT: number = 0.5;
const NEAREST_COL: number = 60;
const TITLE_X: number = 100;

// ---- layout result ----

/** A participant column. `y` is the header's top; created participants start lower. */
export interface Column {
  id: string;
  p: Participant;
  x: number;
  w: number;
  top: number;
  y: number;
  h: number;
  lifeTop: number;
  lifeBottom: number;
  isDestroyed: boolean;
  footY: number;
}

/** Where an item sits: its list key, index and depth. */
export interface ItemPlace {
  key: string;
  index: number;
  y: number;
  depth: number;
}

/** A laid-out message, note, activation or autonumber row. */
export interface Row extends ItemPlace {
  item: SequenceItem;
  h: number;
  ay?: number;
  x1?: number;
  x2?: number;
  isSelf?: boolean;
  labelLines?: number;
  num?: number;
  ny?: number;
  nh?: number;
  nx1?: number;
  nx2?: number;
  cx?: number;
}

export interface BlockSectionBox {
  y: number;
  label: string;
  k: number;
}

export interface BlockBox {
  item: BlockItem;
  key: string;
  index: number;
  depth: number;
  y1: number;
  y2: number;
  x1: number;
  x2: number;
  tabW: number;
  sections: BlockSectionBox[];
}

/** An activation bar; `isOpen` when it runs to the end of the diagram. */
export interface Bar {
  actor: string;
  x: number;
  y1: number;
  y2: number;
  isOpen: boolean;
}

export interface BoxFrame {
  box: SequenceBox;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export interface SequenceLayout {
  title: string;
  titleX: number;
  cols: Column[];
  rows: Row[];
  blocks: BlockBox[];
  /** Insertion points between items. */
  slots: ItemPlace[];
  bars: Bar[];
  boxes: BoxFrame[];
  width: number;
  minX: number;
  height: number;
  headH: number;
  bandBottom: number;
  top: number;
  end: number;
  y0: number;
}

// ---- text ----

export function linesOf(text: string): string[] {
  return displayText(text).split('\n');
}

function textLines(text: string): number {
  return text.trim() === '' ? 0 : linesOf(text).length;
}

function textWidth(text: string, measure: TextMeasurer): number {
  return Math.max(0, ...linesOf(text).map((line: string) => measure(line, FONT)));
}

/** Width of a participant header. */
export function headerWidth(participant: Participant, measure: TextMeasurer): number {
  const width: number = textWidth(participant.label, measure);
  if (ICON_KINDS.has(participant.kind)) {
    return Math.max(ICON_MIN_W, width + ICON_PAD);
  }
  return Math.max(BOX_MIN_W, width + EDGE_PAD + (participant.kind === 'queue' ? QUEUE_EXTRA : 0));
}

function noteWidth(note: NoteItem, measure: TextMeasurer): number {
  return Math.max(NOTE_MIN_W, textWidth(note.text, measure) + NOTE_PAD);
}

function depthOf(items: readonly SequenceItem[]): number {
  return items.reduce(
    (depth: number, item: SequenceItem) =>
      item.t === 'block'
        ? Math.max(
            depth,
            1 +
              Math.max(
                0,
                ...item.sections.map((section: { items: SequenceItem[] }) =>
                  depthOf(section.items),
                ),
              ),
          )
        : depth,
    0,
  );
}

function hasAutonumber(items: readonly SequenceItem[]): boolean {
  return items.some(
    (item: SequenceItem) =>
      item.t === 'autonumber' ||
      (item.t === 'block' &&
        item.sections.some((section: { items: SequenceItem[] }) => hasAutonumber(section.items))),
  );
}

export function isRevHead(head: HeadKind): boolean {
  return HEADS[head].isReversed === true;
}

// ---- horizontal: gaps between participant columns ----

/** Gaps between columns, widened until every message label and note fits. */
class ColumnSpacing {
  readonly gaps: number[];
  left: number;
  right: number;
  readonly #index: Map<string, number>;
  readonly #measure: TextMeasurer;
  readonly #isNumbered: boolean;

  constructor(model: SequenceModel, measure: TextMeasurer) {
    const widths: number[] = model.participants.map((participant: Participant) =>
      headerWidth(participant, measure),
    );
    const count: number = widths.length;
    this.gaps = widths
      .slice(1)
      .map((width: number, index: number) =>
        Math.max(MIN_GAP, (numberAt(widths, index) + width) * HALF + EDGE_PAD),
      );
    this.left = count ? numberAt(widths, 0) * HALF + EDGE_PAD : EMPTY_EDGE;
    this.right = count ? numberAt(widths, count - 1) * HALF + EDGE_PAD : EMPTY_EDGE;
    this.#index = new Map<string, number>(
      model.participants.map((participant: Participant, index: number) => [participant.id, index]),
    );
    this.#measure = measure;
    this.#isNumbered = model.autonumber !== null || hasAutonumber(model.items);
  }

  visit(items: readonly SequenceItem[]): void {
    for (const item of items) {
      if (item.t === 'msg') {
        this.#message(item);
      } else if (item.t === 'note') {
        this.#note(item);
      } else if (item.t === 'block') {
        item.sections.forEach((section: { items: SequenceItem[] }) => {
          this.visit(section.items);
        });
      }
    }
  }

  #message(message: MessageItem): void {
    const from: number | undefined = this.#index.get(message.from);
    const to: number | undefined = this.#index.get(message.to);
    if (from === undefined || to === undefined) {
      return;
    }
    const width: number =
      textWidth(message.text, this.#measure) + (this.#isNumbered ? NUMBER_W : 0);
    if (from === to) {
      this.#needRight(from, width + SELF_ROOM);
    } else {
      this.#widen(Math.min(from, to), Math.max(from, to), width + LABEL_ROOM);
    }
  }

  #note(note: NoteItem): void {
    const index: number | undefined = this.#index.get(textAt(note.actors, 0));
    if (index === undefined) {
      return;
    }
    const width: number = noteWidth(note, this.#measure);
    if (note.placement === 'left') {
      this.#needLeft(index, width + NOTE_ROOM);
    } else if (note.placement === 'right') {
      this.#needRight(index, width + NOTE_ROOM);
    } else if (note.actors.length === 1) {
      this.#needLeft(index, width * HALF + NOTE_HALF_ROOM);
      this.#needRight(index, width * HALF + NOTE_HALF_ROOM);
    }
  }

  #widen(from: number, to: number, need: number): void {
    const have: number = this.gaps
      .slice(from, to)
      .reduce((sum: number, gap: number) => sum + gap, 0);
    for (let index: number = from; need > have && index < to; index++) {
      this.gaps[index] = numberAt(this.gaps, index) + (need - have) / (to - from);
    }
  }

  #needRight(index: number, need: number): void {
    if (index < this.gaps.length) {
      this.gaps[index] = Math.max(numberAt(this.gaps, index), need);
    } else {
      this.right = Math.max(this.right, need);
    }
  }

  #needLeft(index: number, need: number): void {
    if (index > 0) {
      this.gaps[index - 1] = Math.max(numberAt(this.gaps, index - 1), need);
    } else {
      this.left = Math.max(this.left, need);
    }
  }
}

function columnCenters(
  model: SequenceModel,
  measure: TextMeasurer,
): { centers: number[]; width: number } {
  const spacing: ColumnSpacing = new ColumnSpacing(model, measure);
  spacing.visit(model.items);
  const indent: number = depthOf(model.items) * DEPTH_INDENT + EMPTY_EDGE;
  const left: number = Math.max(spacing.left, indent);
  const right: number = Math.max(spacing.right, indent);
  const centers: number[] = model.participants.length
    ? spacing.gaps.reduce(
        (list: number[], gap: number) => [...list, (list.at(-1) ?? left) + gap],
        [left],
      )
    : [];
  return { centers, width: (centers.at(-1) ?? 0) + right };
}

// ---- vertical: rows, blocks, bars ----

const ACT_H: number = 20;
const MISSING_H: number = 24;
const SELF_ACTIVATION: number = 20;
const SELF_EXT: number = 50;
const SELF_H: number = 44;
const SELF_LABEL_GAP: number = 12;
const ARROW_LABEL_GAP: number = 16;
const ARROW_H: number = 30;
const NOTE_ROW_PAD: number = 26;
const NOTE_TOP: number = 6;
const NOTE_BOX_PAD: number = 14;
const NOTE_GAP: number = 8;
const NOTE_SPAN_PAD: number = 50;
const ORPHAN_NOTE_X: number = 20;
const BLOCK_TOP: number = 4;
const BLOCK_HEAD: number = 30;
const SECTION_HEAD: number = 26;
const EMPTY_SECTION: number = 22;
const BLOCK_BOTTOM: number = 6;
const BLOCK_AFTER: number = 12;
const BLOCK_SIDE: number = 12;
const TAB_PAD: number = 18;
const LABEL_PAD: number = 20;
const TAB_LABEL_GAP: number = 16;
const SECTION_LABEL_PAD: number = 40;
const EMPTY_BLOCK_LEFT: number = 20;
const EMPTY_BLOCK_MIN_W: number = 160;
const NO_COLUMNS: Readonly<{ first: number; second: number }> = { first: 40, second: 200 };

interface ArrowEnds {
  place: ItemPlace;
  from: Column;
  to: Column;
  labelLines: number;
}

// A note over one or more participants: centred, wide enough to span them.
function overSpan(cols: readonly Column[], width: number): [number, number] {
  const lo: number = Math.min(...cols.map((col: Column) => col.x));
  const hi: number = Math.max(...cols.map((col: Column) => col.x));
  const span: number = cols.length > 1 ? hi - lo + NOTE_SPAN_PAD : 0;
  const full: number = Math.max(width, span);
  const left: number = (lo + hi) * HALF - full * HALF;
  return [left, left + full];
}

// An empty block spans the first two columns (or a default width when there are none).
function emptyBlockSpan(cols: readonly Column[]): { x1: number; x2: number } {
  const first: number = cols[0]?.x ?? NO_COLUMNS.first;
  const second: number = cols[Math.min(1, cols.length - 1)]?.x ?? NO_COLUMNS.second;
  const x1: number = first - EMPTY_BLOCK_LEFT;
  return { x1, x2: Math.max(second + EMPTY_BLOCK_LEFT, x1 + EMPTY_BLOCK_MIN_W) };
}

interface Numbering {
  n: number;
  step: number;
}

interface Extent {
  y: number;
  x1: number;
  x2: number;
}

interface Activation {
  y1: number;
  level: number;
}

/** Lays rows out top to bottom, tracking activations, numbering and created/destroyed actors. */
class RowLayouter {
  readonly rows: Row[] = [];
  readonly blocks: BlockBox[] = [];
  readonly slots: ItemPlace[] = [];
  readonly bars: Bar[] = [];
  readonly createdAt: Map<string, number> = new Map<string, number>();
  readonly destroyedAt: Map<string, number> = new Map<string, number>();
  readonly #columns: Map<string, Column>;
  readonly #active: Map<string, Activation[]>;
  readonly #headH: number;
  readonly #measure: TextMeasurer;
  readonly #cols: readonly Column[];
  #num: Numbering | null;

  constructor(context: {
    cols: readonly Column[];
    headH: number;
    measure: TextMeasurer;
    autonumber: SequenceModel['autonumber'];
  }) {
    this.#cols = context.cols;
    this.#columns = new Map<string, Column>(context.cols.map((col: Column) => [col.id, col]));
    this.#active = new Map<string, Activation[]>(context.cols.map((col: Column) => [col.id, []]));
    this.#headH = context.headH;
    this.#measure = context.measure;
    const { autonumber } = context;
    this.#num = autonumber?.isVisible
      ? { n: autonumber.start ?? 1, step: autonumber.step ?? 1 }
      : null;
  }

  /** Lays out a list from `y`; returns where it ends and its horizontal extent. */
  list(items: readonly SequenceItem[], key: string, start: { y: number; depth: number }): Extent {
    let extent: Extent = { y: start.y, x1: Infinity, x2: -Infinity };
    this.slots.push({ key, index: 0, y: start.y, depth: start.depth });
    items.forEach((item: SequenceItem, index: number) => {
      const place: ItemPlace = { key, index, y: extent.y, depth: start.depth };
      const placed: Extent = this.#item(item, place);
      extent = {
        y: placed.y,
        x1: Math.min(extent.x1, placed.x1),
        x2: Math.max(extent.x2, placed.x2),
      };
      this.slots.push({ key, index: index + 1, y: extent.y, depth: start.depth });
    });
    return extent;
  }

  /** Closes every activation still open at `end`. */
  closeAll(end: number): void {
    for (const [id, stack] of this.#active) {
      while (stack.length) {
        this.#deactivate(id, end, true);
      }
    }
  }

  #item(item: SequenceItem, place: ItemPlace): Extent {
    switch (item.t) {
      case 'msg':
        return this.#row(this.#message(item, place));
      case 'note':
        return this.#row(this.#note(item, place));
      case 'act':
        return this.#row(this.#activation(item, place));
      case 'autonumber':
        this.#num = item.isVisible
          ? { n: item.start ?? this.#num?.n ?? 1, step: item.step ?? 1 }
          : null;
        return this.#row({ ...place, item, h: ACT_H });
      default:
        return this.#block(item, place);
    }
  }

  #row(row: Row & { ext?: [number, number] }): Extent {
    const { ext, ...stored } = row;
    this.rows.push(stored);
    return { y: row.y + row.h, x1: ext?.[0] ?? Infinity, x2: ext?.[1] ?? -Infinity };
  }

  #message(message: MessageItem, place: ItemPlace): Row & { ext?: [number, number] } {
    const from: Column | undefined = this.#columns.get(message.from);
    const to: Column | undefined = this.#columns.get(message.to);
    const labelLines: number = textLines(message.text);
    const row: Row & { ext?: [number, number] } =
      from && to
        ? this.#arrow(message, { place, from, to, labelLines })
        : { ...place, item: message, h: MISSING_H };
    const ay: number = row.ay ?? place.y;
    if (message.act === '-' && from) {
      this.#deactivate(message.from, ay);
    }
    if (message.act === '+' && message.from === message.to) {
      this.#activate(message.to, ay + SELF_ACTIVATION);
    }
    this.#lifecycle(message, ay);
    return { ...row, labelLines, ...this.#number(Boolean(from && to)) };
  }

  #number(isNumbered: boolean): { num?: number } {
    if (!this.#num || !isNumbered) {
      return {};
    }
    const num: number = this.#num.n;
    this.#num = { ...this.#num, n: num + this.#num.step };
    return { num };
  }

  #lifecycle(message: MessageItem, ay: number): void {
    for (const id of message.create.filter((created: string) => this.#columns.has(created))) {
      this.createdAt.set(id, ay - this.#headH * HALF);
    }
    for (const id of message.destroy.filter((destroyed: string) => this.#columns.has(destroyed))) {
      this.destroyedAt.set(id, ay);
    }
  }

  #arrow(message: MessageItem, ends: ArrowEnds): Row & { ext: [number, number] } {
    return message.from === message.to
      ? this.#selfArrow(message, ends)
      : this.#straightArrow(message, ends);
  }

  #selfArrow(
    message: MessageItem,
    { place, from, labelLines }: ArrowEnds,
  ): Row & { ext: [number, number] } {
    const labelH: number = labelLines * LINE_H;
    const x1: number = this.#edge(message.from, 1);
    const right: number =
      from.x + SELF_EXT + textWidth(message.text, this.#measure) + (this.#num ? NUMBER_W : 0);
    return {
      ...place,
      item: message,
      h: labelH + SELF_H,
      ay: place.y + labelH + SELF_LABEL_GAP,
      x1,
      x2: x1,
      isSelf: true,
      ext: [from.x - BOX_PAD, right],
    };
  }

  #arrowY(message: MessageItem, { place, labelLines }: ArrowEnds): { ay: number; h: number } {
    const labelH: number = labelLines * LINE_H;
    const hasCreated: boolean = message.create.some((id: string) => this.#columns.has(id));
    const createdRoom: number = hasCreated ? this.#headH : 0;
    const gap: number = hasCreated ? SELF_LABEL_GAP + this.#headH * HALF : ARROW_LABEL_GAP;
    return { ay: place.y + labelH + gap, h: labelH + ARROW_H + createdRoom };
  }

  #straightArrow(message: MessageItem, ends: ArrowEnds): Row & { ext: [number, number] } {
    const { place, from, to } = ends;
    const direction: number = to.x > from.x ? 1 : -1;
    const { ay, h } = this.#arrowY(message, ends);
    const x1: number = this.#edge(message.from, direction);
    if (message.act === '+') {
      this.#activate(message.to, ay);
    }
    const isCreatingTarget: boolean = message.create.includes(message.to);
    const x2: number = isCreatingTarget
      ? to.x - direction * to.w * HALF
      : this.#edge(message.to, -direction);
    const ext: [number, number] = [
      Math.min(from.x, to.x) - BOX_PAD,
      Math.max(from.x, to.x) + BOX_PAD,
    ];
    return { ...place, item: message, h, ay, x1, x2, ext };
  }

  #note(note: NoteItem, place: ItemPlace): Row & { ext: [number, number] } {
    const lines: number = Math.max(1, textLines(note.text));
    const [nx1, nx2] = this.#noteSpan(note);
    return {
      ...place,
      item: note,
      h: lines * LINE_H + NOTE_ROW_PAD,
      ny: place.y + NOTE_TOP,
      nh: lines * LINE_H + NOTE_BOX_PAD,
      nx1,
      nx2,
      ext: [nx1, nx2],
    };
  }

  #noteSpan(note: NoteItem): [number, number] {
    const width: number = noteWidth(note, this.#measure);
    const cols: Column[] = note.actors.flatMap((id: string) => this.#columns.get(id) ?? []);
    const first: string = textAt(note.actors, 0);
    if (cols.length === 0) {
      return [ORPHAN_NOTE_X, ORPHAN_NOTE_X + width];
    }
    if (note.placement === 'left') {
      const right: number = this.#edge(first, -1) - NOTE_GAP;
      return [right - width, right];
    }
    if (note.placement === 'right') {
      const left: number = this.#edge(first, 1) + NOTE_GAP;
      return [left, left + width];
    }
    return overSpan(cols, width);
  }

  #activation(item: ActivationItem, place: ItemPlace): Row & { ext?: [number, number] } {
    const col: Column | undefined = this.#columns.get(item.actor);
    if (!col) {
      return { ...place, item, h: ACT_H };
    }
    if (item.isOn) {
      this.#activate(item.actor, place.y + ACT_H * HALF);
    } else {
      this.#deactivate(item.actor, place.y + ACT_H * HALF);
    }
    return { ...place, item, h: ACT_H, cx: col.x, ext: [col.x - BOX_PAD, col.x + BOX_PAD] };
  }

  #sections(block: BlockItem, place: ItemPlace, sections: BlockSectionBox[]): Extent {
    const y1: number = place.y + BLOCK_TOP;
    let extent: Extent = { y: place.y + BLOCK_HEAD, x1: Infinity, x2: -Infinity };
    block.sections.forEach((section: { label: string; items: SequenceItem[] }, k: number) => {
      sections.push({ y: k > 0 ? extent.y : y1, label: section.label, k });
      const y: number = extent.y + (k > 0 ? SECTION_HEAD : 0);
      const laid: Extent = this.list(section.items, `${block.id}:${String(k)}`, {
        y,
        depth: place.depth + 1,
      });
      extent = {
        y: Math.max(laid.y, y + (section.items.length ? 0 : EMPTY_SECTION)),
        x1: Math.min(extent.x1, laid.x1),
        x2: Math.max(extent.x2, laid.x2),
      };
    });
    return extent;
  }

  #block(block: BlockItem, place: ItemPlace): Extent {
    const sections: BlockSectionBox[] = [];
    const index: number = this.blocks.length;
    const y1: number = place.y + BLOCK_TOP;
    this.blocks.push({ item: block, ...place, y1, y2: 0, x1: 0, x2: 0, tabW: 0, sections });
    const inner: Extent = this.#sections(block, place, sections);
    const box: BlockBox = {
      ...this.#blockSpan(block, inner),
      item: block,
      key: place.key,
      index: place.index,
      depth: place.depth,
      y1,
      y2: inner.y + BLOCK_BOTTOM,
      sections,
    };
    this.blocks[index] = box;
    return { y: inner.y + BLOCK_AFTER, x1: box.x1, x2: box.x2 };
  }

  #labelWidths(block: BlockItem, x1: number): { first: number; rest: number[] } {
    const firstLabel: string = block.sections[0]?.label ?? '';
    return {
      first: block.kind === 'rect' ? 0 : textWidth(firstLabel, this.#measure) + LABEL_PAD,
      rest: block.sections
        .slice(1)
        .map(
          (section: { label: string }) =>
            x1 + textWidth(section.label, this.#measure) + SECTION_LABEL_PAD,
        ),
    };
  }

  #blockSpan(block: BlockItem, inner: Extent): { x1: number; x2: number; tabW: number } {
    const span: { x1: number; x2: number } = Number.isFinite(inner.x1)
      ? inner
      : emptyBlockSpan(this.#cols);
    const tabW: number = this.#measure(BLOCKS[block.kind].name, FONT) + TAB_PAD;
    const x1: number = span.x1 - BLOCK_SIDE;
    const labels: { first: number; rest: number[] } = this.#labelWidths(block, x1);
    const x2: number = Math.max(
      span.x2 + BLOCK_SIDE,
      x1 + tabW + labels.first + TAB_LABEL_GAP,
      ...labels.rest,
    );
    return { x1, x2, tabW };
  }

  #edge(id: string, side: number): number {
    const col: Column | undefined = this.#columns.get(id);
    if (!col) {
      return 0;
    }
    const depth: number = this.#active.get(id)?.length ?? 0;
    if (!depth) {
      return col.x;
    }
    const x1: number = col.x - BAR_HALF + (depth - 1) * BAR_HALF;
    return side > 0 ? x1 + BAR_W : x1;
  }

  #activate(id: string, y: number): void {
    const stack: Activation[] | undefined = this.#active.get(id);
    stack?.push({ y1: y, level: stack.length });
  }

  #deactivate(id: string, y: number, isOpen: boolean = false): void {
    const bar: Activation | undefined = this.#active.get(id)?.pop();
    const col: Column | undefined = this.#columns.get(id);
    if (bar && col) {
      this.bars.push({
        actor: id,
        x: col.x - BAR_HALF + bar.level * BAR_HALF,
        y1: bar.y1,
        y2: y,
        isOpen,
      });
    }
  }
}

// ---- assembly ----

function diagramTitle(model: SequenceModel): string {
  const line: string | undefined = model.head.find((text: string) => /^title[\s:]/.test(text));
  return line ? displayText(line.replace(/^title:?\s*/, '')) : '';
}

function bandTop(model: SequenceModel, titleH: number): number {
  if (model.boxes.length === 0) {
    return titleH + PLAIN_TOP;
  }
  return titleH + (model.boxes.some((box: SequenceBox) => box.name) ? TITLED_BOXES_H : BOXES_H);
}

function finalColumns(
  cols: readonly Column[],
  rows: RowLayouter,
  bounds: { bandBottom: number; end: number },
): Column[] {
  return cols.map((col: Column) => {
    const created: number | undefined = rows.createdAt.get(col.id);
    const destroyed: number | undefined = rows.destroyedAt.get(col.id);
    const y: number = created ?? col.y;
    return {
      ...col,
      y,
      lifeTop: created === undefined ? bounds.bandBottom : y + HEAD_H[col.p.kind],
      lifeBottom: destroyed ?? bounds.end,
      isDestroyed: destroyed !== undefined,
      footY: bounds.end,
    };
  });
}

function boxFrames(
  model: SequenceModel,
  cols: readonly Column[],
  span: { y1: number; y2: number },
): BoxFrame[] {
  return model.boxes.flatMap((box: SequenceBox) => {
    const members: Column[] = cols.filter((col: Column) => col.p.box === box.id);
    if (members.length === 0) {
      return [];
    }
    const x1: number = Math.min(...members.map((col: Column) => col.x - col.w * HALF)) - BOX_PAD;
    const x2: number = Math.max(...members.map((col: Column) => col.x + col.w * HALF)) + BOX_PAD;
    return [{ box, x1, x2, ...span }];
  });
}

interface Bands {
  title: string;
  titleH: number;
  top: number;
  headH: number;
  bandBottom: number;
}

function bandsOf(model: SequenceModel): Bands {
  const title: string = diagramTitle(model);
  const titleH: number = title ? TITLE_H : 0;
  const top: number = bandTop(model, titleH);
  const headH: number = Math.max(
    MIN_HEAD,
    ...model.participants.map((participant: Participant) => HEAD_H[participant.kind]),
  );
  return { title, titleH, top, headH, bandBottom: top + headH };
}

type ColumnBase = Pick<
  Column,
  'top' | 'y' | 'h' | 'lifeTop' | 'lifeBottom' | 'isDestroyed' | 'footY'
>;

function columnBase(bands: Bands): ColumnBase {
  return {
    top: bands.top,
    y: bands.top,
    h: bands.headH,
    lifeTop: bands.bandBottom,
    lifeBottom: 0,
    isDestroyed: false,
    footY: 0,
  };
}

function baseColumns(
  model: SequenceModel,
  measure: TextMeasurer,
  bands: Bands,
): { cols: Column[]; width: number } {
  const { centers, width } = columnCenters(model, measure);
  const base: ColumnBase = columnBase(bands);
  const cols: Column[] = model.participants.map((p: Participant, index: number) => ({
    ...base,
    id: p.id,
    p,
    x: centers[index] ?? 0,
    w: headerWidth(p, measure),
  }));
  return { cols, width };
}

function extents(
  body: Extent,
  blocks: readonly BlockBox[],
  width: number,
): { width: number; minX: number } {
  return {
    width: Math.max(
      width,
      body.x2 + EDGE_PAD,
      ...blocks.map((block: BlockBox) => block.x2 + EMPTY_BLOCK_LEFT),
    ),
    minX: Math.min(
      0,
      body.x1 - EMPTY_BLOCK_LEFT,
      ...blocks.map((block: BlockBox) => block.x1 - EMPTY_BLOCK_LEFT),
    ),
  };
}

function titleX(cols: readonly Column[]): number {
  return cols.length ? ((cols[0]?.x ?? 0) + (cols.at(-1)?.x ?? 0)) * HALF : TITLE_X;
}

function bodyOf(
  model: SequenceModel,
  rows: RowLayouter,
  y0: number,
): { body: Extent; end: number } {
  const body: Extent = rows.list(model.items, 'root', { y: y0, depth: 0 });
  const end: number = body.y + END_GAP;
  rows.closeAll(end);
  return { body, end };
}

/** The full canvas geometry of a sequence model. */
export function computeLayout(model: SequenceModel, measure: TextMeasurer): SequenceLayout {
  const bands: Bands = bandsOf(model);
  const { title, headH, bandBottom, top, titleH } = bands;
  const { cols, width } = baseColumns(model, measure, bands);
  const rows: RowLayouter = new RowLayouter({ cols, headH, measure, autonumber: model.autonumber });
  const y0: number = bandBottom + BODY_GAP;
  const { body, end } = bodyOf(model, rows, y0);
  const finished: Column[] = finalColumns(cols, rows, { bandBottom, end });
  const boxes: BoxFrame[] = boxFrames(model, finished, {
    y1: titleH + BOX_TOP,
    y2: end + headH + BOX_PAD,
  });
  return {
    ...{ title, titleX: titleX(finished), cols: finished, boxes },
    ...{ rows: rows.rows, blocks: rows.blocks, slots: rows.slots, bars: rows.bars },
    ...extents(body, rows.blocks, width),
    ...{ height: end + headH + FOOT_GAP, headH, bandBottom, top, end, y0 },
  };
}

/** The nearest insertion slot to a canvas y (deeper slots win ties), skipping `exclude`d ones. */
export function nearestSlot(
  layout: SequenceLayout,
  y: number,
  exclude?: (slot: ItemPlace) => boolean,
): (ItemPlace & { d: number }) | null {
  let best: (ItemPlace & { d: number }) | null = null;
  for (const slot of layout.slots.filter((candidate: ItemPlace) => !exclude?.(candidate))) {
    const d: number = Math.abs(slot.y - y) - slot.depth * SLOT_DEPTH_WEIGHT;
    if (!best || d < best.d) {
      best = { ...slot, d };
    }
  }
  return best;
}

/** The nearest participant column to a canvas x, within `max` pixels. */
export function nearestCol(
  layout: SequenceLayout,
  x: number,
  max: number = NEAREST_COL,
): Column | null {
  let best: { col: Column; d: number } | null = null;
  for (const col of layout.cols) {
    const d: number = Math.abs(col.x - x);
    if (d <= max && (!best || d < best.d)) {
      best = { col, d };
    }
  }
  return best?.col ?? null;
}
