// Model + positions → React Flow nodes (namespace frames, classes, notes, lollipops), as v1's
// ClassEditor built them.
import { allNamespaces, canvasItems } from '@nautink/editors/class/layout';
import { classStyles } from '@nautink/editors/class/styles';
import { nsLeaf } from '@nautink/editors/class/text';

import { classBoxes, positionOf } from './class-boxes.ts';
import { FRAME_PREFIX } from './class-types.ts';
import { canvasTextMeasurer } from '../canvas/text-measurer.ts';

import type { ClassCanvasNode, ClassSelection, FrameFlowNode } from './class-types.ts';
import type { CanvasItem } from '@nautink/editors/class/layout';
import type { ClassStyle } from '@nautink/editors/class/styles';
import type { ClassModel } from '@nautink/editors/class/types';
import type { Rect } from '@nautink/visual-core/geometry';
import type { PositionMap } from '@nautink/visual-core/positions';

const FRAME_Z: number = -10;
const ITEM_Z: number = 1;

interface ItemContext {
  positions: PositionMap;
  selected: ReadonlySet<string>;
  styles: Readonly<Record<string, ClassStyle>>;
}

type NodeBase = Pick<
  ClassCanvasNode,
  'id' | 'position' | 'selected' | 'zIndex' | 'width' | 'height' | 'measured'
>;

function nodeBase(item: CanvasItem, context: ItemContext): NodeBase {
  const { x, y } = positionOf(context.positions, item.id);
  return {
    id: item.id,
    position: { x, y },
    selected: context.selected.has(item.id),
    zIndex: ITEM_Z,
    width: item.size.width,
    height: item.size.height,
    // The size is known from the text, so React Flow can place the node before measuring it.
    measured: { ...item.size },
  };
}

function itemNode(item: CanvasItem, context: ItemContext): ClassCanvasNode {
  const base: NodeBase = nodeBase(item, context);
  if (item.kind === 'class') {
    const style: ClassStyle | undefined = context.styles[item.id];
    return { ...base, type: 'cls', data: { item: item.item, size: item.size, style } };
  }
  if (item.kind === 'note') {
    return { ...base, type: 'note', data: { note: item.item, size: item.size } };
  }
  const label: string = item.item.t1 === 'lolli' ? item.item.from : item.item.to;
  return { ...base, type: 'lolli', data: { label } };
}

function frameTitle(model: ClassModel, id: string): string {
  const label: string = model.namespaces.find((namespace) => namespace.id === id)?.label ?? '';
  return label === '' ? nsLeaf(id) : label;
}

interface FrameContext {
  boxes: ReadonlyMap<string, Rect>;
  group: string | null;
  isReadOnly: boolean;
}

function frameNode(model: ClassModel, id: string, context: FrameContext): FrameFlowNode[] {
  const box: Rect | undefined = context.boxes.get(FRAME_PREFIX + id);
  if (box === undefined) {
    return [];
  }
  const size: { width: number; height: number } = { width: box.w, height: box.h };
  const frame: FrameFlowNode = {
    id: FRAME_PREFIX + id,
    type: 'nsframe',
    position: { x: box.x, y: box.y },
    data: { title: frameTitle(model, id), ...size },
    selected: context.group === id,
    draggable: !context.isReadOnly,
    connectable: false,
    zIndex: FRAME_Z + id.split('.').length,
    ...size,
  };
  return [{ ...frame, measured: { ...size } }];
}

export interface ClassNodesRequest {
  model: ClassModel;
  positions: PositionMap;
  selection: ClassSelection;
  isReadOnly: boolean;
}

/** Namespace frames first (underneath), then classes, notes and lollipop circles. */
export function classNodes(request: ClassNodesRequest): ClassCanvasNode[] {
  const { model, positions, selection } = request;
  const frames: FrameContext = {
    boxes: classBoxes(model, positions),
    group: selection.group,
    isReadOnly: request.isReadOnly,
  };
  const items: ItemContext = {
    positions,
    selected: new Set<string>(selection.nodes),
    styles: classStyles(model),
  };
  return [
    ...allNamespaces(model).flatMap((id) => frameNode(model, id, frames)),
    ...canvasItems(model, canvasTextMeasurer).map((item) => itemNode(item, items)),
  ];
}
