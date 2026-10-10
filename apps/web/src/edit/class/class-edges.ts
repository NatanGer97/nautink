// Relations and note links as React Flow edges (v1's ClassEditor `edges` memo): links attach to
// the facing sides of their boxes, and several links on one side fan out along it.
import { relationEnds } from '@nautink/editors/class/layout';

import { NOTE_LINK_PREFIX } from './class-types.ts';

import type {
  ClassCanvasEdge,
  ClassSelection,
  NoteLinkEdge,
  UmlEdgeData,
  UmlFlowEdge,
} from './class-types.ts';
import type { ClassMark, ClassModel, ClassNote, ClassRelation } from '@nautink/editors/class/types';
import type { Rect } from '@nautink/visual-core/geometry';

const HALF: number = 0.5;
const SIDE_ROOM: number = 16;
const MAX_STEP: number = 18;
const NOTE_LINK_Z: number = 0;
const RELATION_Z: number = 2;

/**
 * The facing sides of two boxes (handle ids t/r/b/l). Normalized by box size, so wide class
 * boxes prefer vertical links.
 */
export function handlesFor(a: Rect, b: Rect): [string, string] {
  const dx: number = b.x + b.w * HALF - (a.x + a.w * HALF);
  const dy: number = b.y + b.h * HALF - (a.y + a.h * HALF);
  if (Math.abs(dx) / (a.w + b.w) > Math.abs(dy) / (a.h + b.h)) {
    return dx > 0 ? ['r', 'l'] : ['l', 'r'];
  }
  return dy > 0 ? ['b', 't'] : ['t', 'b'];
}

/** A relation's two ends: the item ids and their sides. */
interface RelationLine {
  relation: ClassRelation;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  isSelf: boolean;
}

/** One end of a line on one side of a box, and the box at its other end. */
interface LineEnd {
  id: string;
  key: 'sourceOffset' | 'targetOffset';
  other: string;
}

type Offsets = Pick<UmlEdgeData, 'sourceOffset' | 'targetOffset'>;

function lineOf(relation: ClassRelation, boxes: ReadonlyMap<string, Rect>): RelationLine[] {
  const [source, target] = relationEnds(relation);
  const from: Rect | undefined = boxes.get(source);
  const to: Rect | undefined = boxes.get(target);
  if (from === undefined || to === undefined) {
    return [];
  }
  const isSelf: boolean = source === target;
  const [sourceHandle, targetHandle] = isSelf ? ['r', 't'] : handlesFor(from, to);
  return [{ relation, source, target, sourceHandle, targetHandle, isSelf }];
}

function endsBySide(lines: readonly RelationLine[]): Map<string, LineEnd[]> {
  const sides: Map<string, LineEnd[]> = new Map<string, LineEnd[]>();
  const add = (side: string, end: LineEnd): void => {
    sides.set(side, [...(sides.get(side) ?? []), end]);
  };
  for (const line of lines.filter((item) => !item.isSelf)) {
    const id: string = line.relation.id;
    add(`${line.source}|${line.sourceHandle}`, { id, key: 'sourceOffset', other: line.target });
    add(`${line.target}|${line.targetHandle}`, { id, key: 'targetOffset', other: line.source });
  }
  return sides;
}

function centerAlong(box: Rect | undefined, isVertical: boolean): number {
  if (box === undefined) {
    return 0;
  }
  return isVertical ? box.y + box.h * HALF : box.x + box.w * HALF;
}

/** The ends on one side, ordered along it, with the gap between neighbours. */
function sideLayout(
  side: string,
  ends: readonly LineEnd[],
  boxes: ReadonlyMap<string, Rect>,
): { ordered: LineEnd[]; step: number } {
  const [id = '', handle = ''] = side.split('|');
  const isVertical: boolean = handle === 'l' || handle === 'r';
  const box: Rect | undefined = boxes.get(id);
  const room: number = (isVertical ? (box?.h ?? 0) : (box?.w ?? 0)) - SIDE_ROOM;
  const step: number = ends.length > 1 ? Math.min(MAX_STEP, room / (ends.length - 1)) : 0;
  const center = (end: LineEnd): number => centerAlong(boxes.get(end.other), isVertical);
  return { ordered: [...ends].sort((a, b) => center(a) - center(b)), step };
}

/** Each relation's end offsets (px along its side), so links on one side of a box fan out. */
function spreadEnds(
  lines: readonly RelationLine[],
  boxes: ReadonlyMap<string, Rect>,
): Map<string, Offsets> {
  const offsets: Map<string, Offsets> = new Map<string, Offsets>();
  for (const [side, ends] of endsBySide(lines)) {
    const { ordered, step } = sideLayout(side, ends, boxes);
    ordered.forEach((end: LineEnd, index: number) => {
      const current: Offsets = offsets.get(end.id) ?? { sourceOffset: 0, targetOffset: 0 };
      offsets.set(end.id, { ...current, [end.key]: (index - (ends.length - 1) * HALF) * step });
    });
  }
  return offsets;
}

function drawnMark(mark: ClassMark): ClassMark {
  return mark === 'lolli' ? 'none' : mark;
}

function relationData(line: RelationLine, offsets: Offsets | undefined): UmlEdgeData {
  const { relation } = line;
  return {
    t1: drawnMark(relation.t1),
    t2: drawnMark(relation.t2),
    line: relation.line,
    label: relation.label,
    m1: relation.m1,
    m2: relation.m2,
    isSelf: line.isSelf,
    sourceOffset: offsets?.sourceOffset ?? 0,
    targetOffset: offsets?.targetOffset ?? 0,
  };
}

function relationEdge(line: RelationLine, data: UmlEdgeData, isSelected: boolean): UmlFlowEdge {
  const { relation, source, target, sourceHandle, targetHandle } = line;
  return {
    id: relation.id,
    type: 'uml',
    ...{ source, target, sourceHandle, targetHandle },
    selected: isSelected,
    zIndex: RELATION_Z,
    data,
  };
}

function noteLink(note: ClassNote, ends: [Rect, Rect]): NoteLinkEdge {
  const [sourceHandle, targetHandle] = handlesFor(...ends);
  return {
    id: NOTE_LINK_PREFIX + note.id,
    type: 'notelink',
    ...{ source: note.id, target: note.for, sourceHandle, targetHandle },
    selectable: false,
    focusable: false,
    deletable: false,
    zIndex: NOTE_LINK_Z,
  };
}

function noteLinks(model: ClassModel, boxes: ReadonlyMap<string, Rect>): NoteLinkEdge[] {
  return model.notes.flatMap((note) => {
    const from: Rect | undefined = boxes.get(note.id);
    const to: Rect | undefined = note.for === '' ? undefined : boxes.get(note.for);
    return from === undefined || to === undefined ? [] : [noteLink(note, [from, to])];
  });
}

/** Relations whose two ends are on the canvas (fanned out), then the notes' dashed links. */
export function classEdges(
  model: ClassModel,
  boxes: ReadonlyMap<string, Rect>,
  selection: ClassSelection,
): ClassCanvasEdge[] {
  const selected: Set<string> = new Set<string>(selection.edges);
  const lines: RelationLine[] = model.relations.flatMap((relation) => lineOf(relation, boxes));
  const offsets: Map<string, Offsets> = spreadEnds(lines, boxes);
  return [
    ...lines.map((line) =>
      relationEdge(
        line,
        relationData(line, offsets.get(line.relation.id)),
        selected.has(line.relation.id),
      ),
    ),
    ...noteLinks(model, boxes),
  ];
}
