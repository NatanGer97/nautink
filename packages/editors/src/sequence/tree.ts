// Plumbing for the item tree: lists by key, paths, ranges, and tree-wide maps.
import { walkItems } from './model.ts';

import type { ItemVisit } from './model.ts';
import type { BlockItem, Section, SequenceItem, SequenceModel } from './types.ts';

/** Where to insert: a list ('root' or `<blockId>:<sectionIndex>`) and an index in it. */
export interface Slot {
  key: string;
  index: number;
}

/** One step of the path from the root to an item. */
export interface PathStep {
  key: string;
  index: number;
  id: string;
}

/** What a tree map returns per item: the item, nothing (drop it) or several items (splice). */
export type TreeMapResult = SequenceItem | null | SequenceItem[];

function sectionKey(block: BlockItem, index: number): string {
  return `${block.id}:${String(index)}`;
}

type ListEdit = (list: SequenceItem[]) => SequenceItem[];

function editSections(block: BlockItem, key: string, edit: ListEdit): BlockItem {
  return {
    ...block,
    sections: block.sections.map((section: Section, index: number) => ({
      ...section,
      items:
        sectionKey(block, index) === key
          ? edit([...section.items])
          : editList(section.items, key, edit),
    })),
  };
}

/** Applies `edit` to the item list named by `key`. */
export function editList(
  items: readonly SequenceItem[],
  key: string,
  edit: ListEdit,
): SequenceItem[] {
  if (key === 'root') {
    return edit([...items]);
  }
  return items.map((item: SequenceItem) =>
    item.t === 'block' ? editSections(item, key, edit) : item,
  );
}

/** Maps every item; children of returned blocks are mapped too. */
export function mapTree(
  items: readonly SequenceItem[],
  map: (item: SequenceItem) => TreeMapResult,
): SequenceItem[] {
  return items.flatMap((item: SequenceItem) => {
    const result: TreeMapResult = map(item);
    const list: SequenceItem[] = result === null ? [] : [result].flat();
    return list.map((mapped: SequenceItem) =>
      mapped.t === 'block'
        ? {
            ...mapped,
            sections: mapped.sections.map((section: Section) => ({
              ...section,
              items: mapTree(section.items, map),
            })),
          }
        : mapped,
    );
  });
}

function findPath(items: readonly SequenceItem[], key: string, id: string): PathStep[] | null {
  for (const [index, item] of items.entries()) {
    const step: PathStep = { key, index, id: item.id };
    if (item.id === id) {
      return [step];
    }
    const inner: PathStep[] | null =
      item.t === 'block'
        ? item.sections.reduce<PathStep[] | null>(
            (found: PathStep[] | null, section: Section, sectionIndex: number) =>
              found ?? findPath(section.items, sectionKey(item, sectionIndex), id),
            null,
          )
        : null;
    if (inner) {
      return [step, ...inner];
    }
  }
  return null;
}

/** The path from the root to an item, or null when there is no such item. */
export function pathOf(model: SequenceModel, id: string): PathStep[] | null {
  return findPath(model.items, 'root', id);
}

/** The items of the list named by `key` (empty when there is no such list). */
export function listByKey(model: SequenceModel, key: string): SequenceItem[] {
  if (key === 'root') {
    return model.items;
  }
  const [blockId = '', sectionIndex = ''] = key.split(':');
  let hit: SequenceItem[] = [];
  walkItems(model.items, ({ item }: ItemVisit) => {
    if (item.id === blockId && item.t === 'block') {
      hit = item.sections[Number(sectionIndex)]?.items ?? [];
    }
  });
  return hit;
}

function commonDepth(first: readonly PathStep[], second: readonly PathStep[]): number {
  let depth: number = 0;
  while (
    depth < first.length &&
    depth < second.length &&
    first[depth]?.key === second[depth]?.key &&
    first[depth]?.id === second[depth]?.id
  ) {
    depth++;
  }
  return depth;
}

/** Ids of the contiguous sibling range covering items `a` and `b`, lifted to their common list. */
export function rangeBetween(model: SequenceModel, a: string, b: string): string[] {
  const first: PathStep[] | null = pathOf(model, a);
  const second: PathStep[] | null = pathOf(model, b);
  if (!first || !second) {
    return [b];
  }
  const depth: number = commonDepth(first, second);
  const stepA: PathStep | undefined = first[depth];
  const stepB: PathStep | undefined = second[depth];
  if (!stepA || !stepB) {
    return [(stepA ? second : first).at(-1)?.id ?? b];
  }
  if (stepA.key !== stepB.key) {
    return [b];
  }
  const [start, end] = [stepA.index, stepB.index].sort((x: number, y: number) => x - y);
  return listByKey(model, stepA.key)
    .slice(start, (end ?? 0) + 1)
    .map((item: SequenceItem) => item.id);
}

function lastSteps(model: SequenceModel, ids: readonly string[]): PathStep[] {
  return ids
    .map((id: string) => pathOf(model, id)?.at(-1))
    .filter((step: PathStep | undefined): step is PathStep => step !== undefined);
}

/** When the ids are contiguous siblings: their list and index range; otherwise null. */
export function siblingRange(
  model: SequenceModel,
  ids: readonly string[],
): { key: string; start: number; end: number } | null {
  const steps: PathStep[] = lastSteps(model, ids);
  const key: string | undefined = steps[0]?.key;
  if (
    key === undefined ||
    steps.length !== ids.length ||
    steps.some((step: PathStep) => step.key !== key)
  ) {
    return null;
  }
  const indices: number[] = steps
    .map((step: PathStep) => step.index)
    .sort((x: number, y: number) => x - y);
  const start: number = indices[0] ?? 0;
  const end: number = indices.at(-1) ?? 0;
  return end - start === indices.length - 1 ? { key, start, end } : null;
}

/** Is `id` anywhere inside `item` (when it is a block)? */
export function containsItem(item: SequenceItem, id: string): boolean {
  let isFound: boolean = false;
  if (item.t === 'block') {
    for (const section of item.sections) {
      walkItems(section.items, ({ item: inner }: ItemVisit) => {
        isFound ||= inner.id === id;
      });
    }
  }
  return isFound;
}

/** Is the list `key` inside block `id` (one of its sections, or deeper)? */
export function isDescendantKey(model: SequenceModel, id: string, key: string): boolean {
  const [blockId = ''] = key.split(':');
  let isDescendant: boolean = false;
  walkItems(model.items, ({ item }: ItemVisit) => {
    if (item.id === id && item.t === 'block') {
      isDescendant = item.id === blockId || containsItem(item, blockId);
    }
  });
  return isDescendant;
}
