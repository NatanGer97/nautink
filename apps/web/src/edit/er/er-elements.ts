// Model + positions → React Flow nodes and edges, as v1's EREditor built them: group frames around
// their members, and relationships that attach to the facing sides of their two boxes, spread out
// along a side when several share it.
import { parentMap } from '@nautink/editors/shared/subgraphs';

import { entityBox } from './er-layout.ts';
import { markerId } from './er-markers.tsx';

import type {
  EntityFlowNode,
  ErCanvasEdge,
  ErCanvasNode,
  ErCanvasSelection,
  ErEdgeData,
  ErGroupFlowNode,
} from './er-types.ts';
import type { ErEntity, ErModel, ErRelationship, ErSubgraph } from '@nautink/editors/er/model';
import type { EntityLayout } from '@nautink/editors/er/size';
import type { Point, Rect } from '@nautink/visual-core/geometry';
import type { Position, PositionMap } from '@nautink/visual-core/positions';

const GROUP_PAD: number = 24;
const GROUP_TITLE: number = 22;
const GROUP_Z: number = -10;
/** Tables sit above links, so a link never crosses a table (v1). */
const ENTITY_Z: number = 3;
const EDGE_Z: number = 2;
const HALF: number = 0.5;
/** Boxes this far apart sideways link left/right even when one is a little above the other. */
const SIDE_GAP: number = 40;
const MAX_SPREAD: number = 24;
const SIDE_MARGIN: number = 12;
const ORIGIN: Position = { x: 0, y: 0 };
const NO_BOX: Rect = { x: 0, y: 0, w: 0, h: 0 };

export type Side = 't' | 'r' | 'b' | 'l';

function positionOf(positions: PositionMap, id: string): Position {
  return (Object.hasOwn(positions, id) ? positions[id] : undefined) ?? ORIGIN;
}

function groupBox(subgraph: ErSubgraph, boxes: ReadonlyMap<string, Rect>): Rect | undefined {
  const inner: Rect[] = subgraph.members.flatMap((id) => {
    const box: Rect | undefined = boxes.get(id);
    return box === undefined ? [] : [box];
  });
  if (inner.length === 0) {
    return undefined;
  }
  const x: number = Math.min(...inner.map((box) => box.x)) - GROUP_PAD;
  const y: number = Math.min(...inner.map((box) => box.y)) - GROUP_PAD - GROUP_TITLE;
  const right: number = Math.max(...inner.map((box) => box.x + box.w)) + GROUP_PAD;
  const bottom: number = Math.max(...inner.map((box) => box.y + box.h)) + GROUP_PAD;
  return { x, y, w: right - x, h: bottom - y };
}

/** The box of every entity and subgraph. Inner subgraphs come first, so outer frames wrap them. */
export function erBoxes(model: ErModel, positions: PositionMap): Map<string, Rect> {
  const boxes: Map<string, Rect> = new Map<string, Rect>();
  for (const entity of model.entities) {
    const { width, height }: EntityLayout = entityBox(entity);
    const { x, y } = positionOf(positions, entity.name);
    boxes.set(entity.name, { x, y, w: width, h: height });
  }
  for (const subgraph of model.subgraphs) {
    const box: Rect | undefined = groupBox(subgraph, boxes);
    if (box !== undefined) {
      boxes.set(subgraph.id, box);
    }
  }
  return boxes;
}

function entityNode(entity: ErEntity, box: Rect, isSelected: boolean): EntityFlowNode {
  return {
    id: entity.name,
    type: 'entity',
    position: { x: box.x, y: box.y },
    data: { entity },
    selected: isSelected,
    zIndex: ENTITY_Z,
    width: box.w,
    height: box.h,
    // The size is known from the text, so React Flow can place the node before measuring it.
    measured: { width: box.w, height: box.h },
  };
}

function depthOf(id: string, parent: ReadonlyMap<string, string>): number {
  const above: string | undefined = parent.get(id);
  return above === undefined ? 0 : 1 + depthOf(above, parent);
}

function groupNode(subgraph: ErSubgraph, box: Rect, depth: number): ErGroupFlowNode {
  return {
    id: subgraph.id,
    type: 'subgraph',
    position: { x: box.x, y: box.y },
    data: { title: subgraph.title, width: box.w, height: box.h },
    draggable: false,
    selected: false,
    zIndex: GROUP_Z + depth,
    width: box.w,
    height: box.h,
    measured: { width: box.w, height: box.h },
  };
}

function groupNodes(
  model: ErModel,
  boxes: ReadonlyMap<string, Rect>,
  selected: string | null,
): ErGroupFlowNode[] {
  const parent: Map<string, string> = parentMap(model.subgraphs);
  return model.subgraphs.flatMap((subgraph): ErGroupFlowNode[] => {
    const box: Rect | undefined = boxes.get(subgraph.id);
    if (box === undefined) {
      return [];
    }
    const node: ErGroupFlowNode = groupNode(subgraph, box, depthOf(subgraph.id, parent));
    return [{ ...node, selected: selected === subgraph.id }];
  });
}

/** Group frames first (underneath), then the entity tables. */
export function erNodes(
  model: ErModel,
  positions: PositionMap,
  selection: ErCanvasSelection,
): ErCanvasNode[] {
  const selected: Set<string> = new Set<string>(selection.entities);
  const boxes: Map<string, Rect> = erBoxes(model, positions);
  return [
    ...groupNodes(model, boxes, selection.group),
    ...model.entities.flatMap((entity) => {
      const box: Rect | undefined = boxes.get(entity.name);
      return box === undefined ? [] : [entityNode(entity, box, selected.has(entity.name))];
    }),
  ];
}

function gapBetween(a: Rect, b: Rect): Point {
  return {
    x: Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)),
    y: Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h)),
  };
}

function centerOf(box: Rect): Point {
  return { x: box.x + box.w * HALF, y: box.y + box.h * HALF };
}

/** The facing sides of two boxes. Tables are wide, so left/right wins unless one is clearly above. */
export function handlesFor(a: Rect, b: Rect): [Side, Side] {
  const from: Point = centerOf(a);
  const to: Point = centerOf(b);
  const dx: number = to.x - from.x;
  const dy: number = to.y - from.y;
  const gap: Point = gapBetween(a, b);
  const isSideways: boolean = gap.x > SIDE_GAP || (gap.y < SIDE_GAP && Math.abs(dx) > Math.abs(dy));
  if (isSideways) {
    return dx > 0 ? ['r', 'l'] : ['l', 'r'];
  }
  return dy > 0 ? ['b', 't'] : ['t', 'b'];
}

/** One link end on one side of a box; `order` sorts the ends along that side. */
interface SideEnd {
  key: string;
  order: number;
}

interface RoutedRel {
  rel: ErRelationship;
  sides: [Side, Side];
}

function isAcross(side: Side): boolean {
  return side === 'l' || side === 'r';
}

function endOrder(side: Side, other: Point, isSelf: boolean): number {
  if (isSelf) {
    return side === 'r' ? -Infinity : Infinity;
  }
  return isAcross(side) ? other.y : other.x;
}

interface EndSpec {
  node: string;
  side: Side;
  other: string;
  end: 'source' | 'target';
}

function sideEnds(
  routed: readonly RoutedRel[],
  boxes: ReadonlyMap<string, Rect>,
): Map<string, SideEnd[]> {
  const ends: Map<string, SideEnd[]> = new Map<string, SideEnd[]>();
  const add = ({ node, side, other, end }: EndSpec, rel: ErRelationship): void => {
    const otherBox: Rect = boxes.get(other) ?? NO_BOX;
    const order: number = endOrder(side, centerOf(otherBox), rel.from === rel.to);
    const list: SideEnd[] = ends.get(`${node}:${side}`) ?? [];
    ends.set(`${node}:${side}`, [...list, { key: `${rel.id}:${end}`, order }]);
  };
  for (const { rel, sides } of routed) {
    add({ node: rel.from, side: sides[0], other: rel.to, end: 'source' }, rel);
    add({ node: rel.to, side: sides[1], other: rel.from, end: 'target' }, rel);
  }
  return ends;
}

function sideLength(boxes: ReadonlyMap<string, Rect>, sideKey: string): number {
  const at: number = sideKey.lastIndexOf(':');
  const box: Rect | undefined = boxes.get(sideKey.slice(0, at));
  const side: string = sideKey.slice(at + 1);
  return side === 'l' || side === 'r' ? (box?.h ?? 0) : (box?.w ?? 0);
}

/** How far each link end slides along its side (keyed `<rel id>:source|target`). */
export function endShifts(
  routed: readonly RoutedRel[],
  boxes: ReadonlyMap<string, Rect>,
): Map<string, number> {
  const shifts: Map<string, number> = new Map<string, number>();
  for (const [sideKey, list] of sideEnds(routed, boxes)) {
    const step: number = Math.min(
      MAX_SPREAD,
      (sideLength(boxes, sideKey) - SIDE_MARGIN) / list.length,
    );
    const sorted: SideEnd[] = [...list].sort((a, b) => a.order - b.order);
    sorted.forEach((end, index) => {
      shifts.set(end.key, (index - (sorted.length - 1) * HALF) * step);
    });
  }
  return shifts;
}

function route(rel: ErRelationship, boxes: ReadonlyMap<string, Rect>): RoutedRel[] {
  const from: Rect | undefined = boxes.get(rel.from);
  const to: Rect | undefined = boxes.get(rel.to);
  if (from === undefined || to === undefined) {
    return [];
  }
  return [{ rel, sides: rel.from === rel.to ? ['r', 't'] : handlesFor(from, to) }];
}

function edgeData(rel: ErRelationship, shifts: ReadonlyMap<string, number>): ErEdgeData {
  return {
    label: rel.label,
    isIdentifying: rel.isIdentifying,
    isSelf: rel.from === rel.to,
    sourceShift: shifts.get(`${rel.id}:source`) ?? 0,
    targetShift: shifts.get(`${rel.id}:target`) ?? 0,
  };
}

function canvasEdge(
  routed: RoutedRel,
  shifts: ReadonlyMap<string, number>,
  isSelected: boolean,
): ErCanvasEdge {
  const { rel, sides } = routed;
  return {
    id: rel.id,
    type: 'relationship',
    source: rel.from,
    target: rel.to,
    sourceHandle: sides[0],
    targetHandle: sides[1],
    markerStart: markerId(rel.fromCard, isSelected),
    markerEnd: markerId(rel.toCard, isSelected),
    selected: isSelected,
    zIndex: EDGE_Z,
    data: edgeData(rel, shifts),
  };
}

/** The relationships whose two ends are on the canvas. */
export function erEdges(
  model: ErModel,
  positions: PositionMap,
  selection: ErCanvasSelection,
): ErCanvasEdge[] {
  const boxes: Map<string, Rect> = erBoxes(model, positions);
  const routed: RoutedRel[] = model.rels.flatMap((rel) => route(rel, boxes));
  const shifts: Map<string, number> = endShifts(routed, boxes);
  const selected: Set<string> = new Set<string>(selection.rels);
  return routed.map((item) => canvasEdge(item, shifts, selected.has(item.rel.id)));
}
