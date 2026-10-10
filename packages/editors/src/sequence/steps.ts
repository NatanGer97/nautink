// Keyboard moves of sequence items: one step up or down through the tree, into and out of blocks.
import { findItem, listKey } from './model.ts';
import { moveItems } from './ops.ts';
import { listByKey, pathOf, siblingRange } from './tree.ts';

import type { ItemVisit } from './model.ts';
import type { PathStep, Slot } from './tree.ts';
import type { Section, SequenceItem, SequenceModel } from './types.ts';

/** Up (-1) or down (1). */
export type StepDirection = -1 | 1;

// Slots count the moving items too: just past the next sibling is two places after the last one.
const PAST_NEXT: number = 2;

interface Range {
  key: string;
  start: number;
  end: number;
}

/** The slot right after an item, in its own list; the end of the diagram when there is no such item. */
export function slotAfter(model: SequenceModel, id: string): Slot {
  const last: PathStep | undefined = pathOf(model, id)?.at(-1);
  return last ? { key: last.key, index: last.index + 1 } : endSlot(model);
}

/** The slot at the end of the diagram. */
export function endSlot(model: SequenceModel): Slot {
  return { key: 'root', index: model.items.length };
}

// Past the first or last item of a section: the neighbouring section, or out of the block.
function edgeSlot(model: SequenceModel, key: string, direction: StepDirection): Slot | null {
  const [blockId = '', section = '0'] = key.split(':');
  const block: ItemVisit | null = key === 'root' ? null : findItem(model, blockId);
  if (block?.item.t !== 'block') {
    return null;
  }
  const next: number = Number(section) + direction;
  const target: Section | undefined = block.item.sections[next];
  if (target) {
    return { key: `${blockId}:${String(next)}`, index: direction < 0 ? target.items.length : 0 };
  }
  const parent: string = listKey(block.parent, block.sectionIndex);
  return { key: parent, index: direction < 0 ? block.index : block.index + 1 };
}

// Next to a sibling: step over it, or into the near end of a block.
function siblingSlot(neighbour: SequenceItem, range: Range, direction: StepDirection): Slot {
  if (neighbour.t !== 'block') {
    return { key: range.key, index: direction < 0 ? range.start - 1 : range.end + PAST_NEXT };
  }
  if (direction > 0) {
    return { key: `${neighbour.id}:0`, index: 0 };
  }
  const last: number = neighbour.sections.length - 1;
  const items: number = neighbour.sections[last]?.items.length ?? 0;
  return { key: `${neighbour.id}:${String(last)}`, index: items };
}

/**
 * Moves contiguous sibling items one step up or down: past a neighbour, into the near end of a
 * neighbouring block, into the next section, or out of their block. Unchanged at the very top or
 * bottom, or when the items are not contiguous siblings.
 */
export function stepItems(
  model: SequenceModel,
  ids: readonly string[],
  direction: StepDirection,
): SequenceModel {
  const range: Range | null = siblingRange(model, ids);
  if (range === null) {
    return model;
  }
  const neighbour: SequenceItem | undefined = listByKey(model, range.key)[
    direction < 0 ? range.start - 1 : range.end + 1
  ];
  const slot: Slot | null = neighbour
    ? siblingSlot(neighbour, range, direction)
    : edgeSlot(model, range.key, direction);
  return slot === null ? model : moveItems(model, ids, slot);
}
