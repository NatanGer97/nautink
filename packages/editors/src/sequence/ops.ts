// Pure sequence-model edits. Each returns a new model (some return { model, id }).
import { BLOCKS } from './constants.ts';
import { newId, walkItems } from './model.ts';
import {
  containsItem,
  editList,
  isDescendantKey,
  listByKey,
  mapTree,
  pathOf,
  siblingRange,
} from './tree.ts';

import type { ItemVisit } from './model.ts';
import type { Slot } from './tree.ts';
import type {
  ActivationItem,
  AutonumberItem,
  BlockItem,
  BlockKind,
  MessageItem,
  NoteItem,
  NotePlacement,
  Participant,
  Section,
  SequenceItem,
  SequenceModel,
} from './types.ts';

/** A model edit that also returns the id of what it created. */
export interface Edited {
  model: SequenceModel;
  id: string;
}

/** Fields any item kind may patch (an item keeps its kind and id). */
export type ItemPatch = Partial<Omit<MessageItem, 't' | 'id'>> &
  Partial<Pick<NoteItem, 'placement' | 'actors'>> &
  Partial<Pick<ActivationItem, 'actor' | 'isOn'>> &
  Partial<Pick<AutonumberItem, 'start' | 'step' | 'isVisible'>> &
  Partial<Pick<BlockItem, 'kind' | 'sections'>>;

const RECT_FILL: string = 'rgba(127, 127, 255, 0.15)';
const BLOCK_LABELS: Readonly<Partial<Record<BlockKind, string>>> = {
  loop: 'every second',
  alt: 'success',
  opt: 'optional',
  par: 'in parallel',
  par_over: 'in parallel',
  critical: 'must succeed',
  break: 'on failure',
};
const MORE_LABELS: Readonly<Partial<Record<BlockKind, string>>> = {
  alt: 'failure',
  par: 'meanwhile',
  par_over: 'meanwhile',
  critical: 'on error',
};

function defaultBlockLabel(kind: BlockKind): string {
  return BLOCK_LABELS[kind] ?? '';
}

function defaultMoreLabel(kind: BlockKind): string {
  return MORE_LABELS[kind] ?? '';
}

// ---- lifecycle: create / destroy ----

function references(item: SequenceItem): string[] {
  switch (item.t) {
    case 'msg':
      return [item.from, item.to];
    case 'note':
      return item.actors;
    case 'act':
      return [item.actor];
    default:
      return [];
  }
}

function hasDestroy(items: readonly SequenceItem[]): boolean {
  let isFound: boolean = false;
  walkItems([...items], ({ item }: ItemVisit) => {
    isFound ||= item.t === 'msg' && item.destroy.length > 0;
  });
  return isFound;
}

// The first item that references each created participant.
function firstReferences(
  model: SequenceModel,
  created: ReadonlySet<string>,
): Map<string, SequenceItem> {
  const first: Map<string, SequenceItem> = new Map<string, SequenceItem>();
  walkItems(model.items, ({ item }: ItemVisit) => {
    for (const id of references(item).filter(
      (ref: string) => created.has(ref) && !first.has(ref),
    )) {
      first.set(id, item);
    }
  });
  return first;
}

// A created participant stays created when its first reference is a message that targets it.
function keptCreations(
  created: ReadonlySet<string>,
  first: ReadonlyMap<string, SequenceItem>,
): Set<string> {
  return new Set<string>(
    [...created].filter((id: string) => {
      const item: SequenceItem | undefined = first.get(id);
      return item?.t === 'msg' && item.to === id && item.from !== id;
    }),
  );
}

function fixedMessage(
  message: MessageItem,
  keep: ReadonlySet<string>,
  first: ReadonlyMap<string, SequenceItem>,
): MessageItem {
  const create: string[] =
    keep.has(message.to) && first.get(message.to) === message ? [message.to] : [];
  const destroy: string[] = message.destroy.filter(
    (id: string) => id === message.from || id === message.to,
  );
  const isSame: boolean =
    create.join() === message.create.join() && destroy.join() === message.destroy.join();
  return isSame ? message : { ...message, create, destroy };
}

function createdIds(model: SequenceModel): Set<string> {
  return new Set<string>(
    model.participants
      .filter((participant: Participant) => participant.isCreated)
      .map((participant: Participant) => participant.id),
  );
}

interface Lifecycle {
  keep: ReadonlySet<string>;
  first: ReadonlyMap<string, SequenceItem>;
}

function hasFixes(model: SequenceModel, lifecycle: Lifecycle): boolean {
  let isChanged: boolean = false;
  walkItems(model.items, ({ item }: ItemVisit) => {
    isChanged ||= item.t === 'msg' && fixedMessage(item, lifecycle.keep, lifecycle.first) !== item;
  });
  return isChanged;
}

/**
 * Keeps `create` / `destroy` valid after edits. A created participant must be created by the
 * first message that references it (as its target); otherwise it becomes a normal participant.
 * `destroy X` must precede a message that involves X.
 */
export function fixLifecycle(model: SequenceModel): SequenceModel {
  const created: Set<string> = createdIds(model);
  if (!created.size && !hasDestroy(model.items)) {
    return model;
  }
  const first: Map<string, SequenceItem> = firstReferences(model, created);
  const keep: Set<string> = keptCreations(created, first);
  const lost: string[] = [...created].filter((id: string) => !keep.has(id));
  if (!hasFixes(model, { keep, first }) && lost.length === 0) {
    return model;
  }
  const items: SequenceItem[] = mapTree(model.items, (item: SequenceItem) =>
    item.t === 'msg' ? fixedMessage(item, keep, first) : item,
  );
  const participants: Participant[] = model.participants.map((participant: Participant) =>
    lost.includes(participant.id) ? { ...participant, isCreated: false } : participant,
  );
  return normalizeOrder({ ...model, items, participants });
}

function withItems(model: SequenceModel, items: SequenceItem[]): SequenceModel {
  return fixLifecycle({ ...model, items });
}

/** Participants in the order Mermaid gives them once all normal ones are declared up front. */
export function normalizeOrder(model: SequenceModel): SequenceModel {
  const normal: Participant[] = model.participants.filter(
    (participant: Participant) => !participant.isCreated,
  );
  const created: string[] = [];
  walkItems(model.items, ({ item }: ItemVisit) => {
    created.push(...(item.t === 'msg' ? item.create : []));
  });
  const byId: Map<string, Participant> = new Map<string, Participant>(
    model.participants.map((participant: Participant) => [participant.id, participant]),
  );
  const ordered: Participant[] = created.flatMap((id: string) => byId.get(id) ?? []);
  const rest: Participant[] = model.participants.filter(
    (participant: Participant) => participant.isCreated && !created.includes(participant.id),
  );
  return { ...model, participants: [...normal, ...ordered, ...rest] };
}

// ---- items ----

export function insertItem(model: SequenceModel, slot: Slot, item: SequenceItem): SequenceModel {
  return withItems(
    model,
    editList(model.items, slot.key, (list: SequenceItem[]) => [
      ...list.slice(0, slot.index),
      item,
      ...list.slice(slot.index),
    ]),
  );
}

function patched(item: SequenceItem, patch: ItemPatch): SequenceItem {
  return { ...item, ...patch };
}

/** Patches an item, with fields or with a function of the item. */
export function updateItem(
  model: SequenceModel,
  id: string,
  patch: ItemPatch | ((item: SequenceItem) => ItemPatch),
): SequenceModel {
  return withItems(
    model,
    mapTree(model.items, (item: SequenceItem) => {
      if (item.id !== id) {
        return item;
      }
      return patched(item, typeof patch === 'function' ? patch(item) : patch);
    }),
  );
}

export function deleteItems(model: SequenceModel, ids: readonly string[]): SequenceModel {
  return withItems(
    model,
    mapTree(model.items, (item: SequenceItem) => (ids.includes(item.id) ? null : item)),
  );
}

function collect(model: SequenceModel, ids: readonly string[]): SequenceItem[] {
  const moving: SequenceItem[] = [];
  walkItems(model.items, ({ item }: ItemVisit) => {
    if (ids.includes(item.id)) {
      moving.push(item);
    }
  });
  return moving.filter(
    (item: SequenceItem) =>
      !moving.some((other: SequenceItem) => other !== item && containsItem(other, item.id)),
  );
}

// Removing items above the slot in the same list shifts it up.
function shiftedIndex(model: SequenceModel, ids: readonly string[], slot: Slot): number {
  const above: SequenceItem[] = listByKey(model, slot.key).slice(0, slot.index);
  return slot.index - above.filter((item: SequenceItem) => ids.includes(item.id)).length;
}

/** Moves items (contiguous siblings, or a single item) to a slot. Never into themselves. */
export function moveItems(model: SequenceModel, ids: readonly string[], slot: Slot): SequenceModel {
  const isInside = (key: string): boolean =>
    ids.some((id: string) => key.startsWith(`${id}:`) || isDescendantKey(model, id, key));
  if (!pathOf(model, ids[0] ?? '') || (slot.key !== 'root' && isInside(slot.key))) {
    return model;
  }
  const index: number = shiftedIndex(model, ids, slot);
  const top: SequenceItem[] = collect(model, ids);
  const without: SequenceModel = deleteItems(model, ids);
  return withItems(
    without,
    editList(without.items, slot.key, (list: SequenceItem[]) => [
      ...list.slice(0, index),
      ...top,
      ...list.slice(index),
    ]),
  );
}

function newSections(kind: BlockKind, items: SequenceItem[]): Section[] {
  const label: string = kind === 'rect' ? RECT_FILL : defaultBlockLabel(kind);
  return [
    { label, items },
    ...(BLOCKS[kind].more ? [{ label: defaultMoreLabel(kind), items: [] }] : []),
  ];
}

/** Wraps contiguous sibling items in a new block; with no such selection, adds an empty block at the end. */
export function wrapItems(model: SequenceModel, ids: readonly string[], kind: BlockKind): Edited {
  const range: { key: string; start: number; end: number } | null = siblingRange(model, ids);
  const id: string = newId();
  if (!range) {
    const block: BlockItem = { t: 'block', id, kind, sections: newSections(kind, []) };
    return { model: insertItem(model, { key: 'root', index: model.items.length }, block), id };
  }
  const items: SequenceItem[] = editList(model.items, range.key, (list: SequenceItem[]) => {
    const block: BlockItem = {
      t: 'block',
      id,
      kind,
      sections: newSections(kind, list.slice(range.start, range.end + 1)),
    };
    return [...list.slice(0, range.start), block, ...list.slice(range.end + 1)];
  });
  return { model: withItems(model, items), id };
}

/** Removes a block, keeping its items in its place. */
export function unwrap(model: SequenceModel, blockId: string): SequenceModel {
  return withItems(
    model,
    mapTree(model.items, (item: SequenceItem) =>
      item.id === blockId && item.t === 'block'
        ? item.sections.flatMap((section: Section) => section.items)
        : item,
    ),
  );
}

function blockPatch(item: SequenceItem, edit: (block: BlockItem) => ItemPatch): ItemPatch {
  return item.t === 'block' ? edit(item) : {};
}

function sectionsFor(block: BlockItem, kind: BlockKind): Section[] {
  const [first = { label: '', items: [] }, ...rest] = block.sections;
  if (!BLOCKS[kind].more && rest.length) {
    return sectionsFor(
      {
        ...block,
        sections: [
          { ...first, items: block.sections.flatMap((section: Section) => section.items) },
        ],
      },
      kind,
    );
  }
  if (kind === 'rect' && block.kind !== 'rect') {
    return [{ ...first, label: RECT_FILL }];
  }
  return kind !== 'rect' && block.kind === 'rect'
    ? [{ ...first, label: defaultBlockLabel(kind) }, ...rest]
    : block.sections;
}

/** Changes a block's kind; kinds without extra sections merge them into the first. */
export function setBlockKind(model: SequenceModel, id: string, kind: BlockKind): SequenceModel {
  return updateItem(model, id, (item: SequenceItem) =>
    blockPatch(item, (block: BlockItem) => ({ kind, sections: sectionsFor(block, kind) })),
  );
}

export interface SectionRef {
  blockId: string;
  sectionIndex: number;
}

export function setSectionLabel(
  model: SequenceModel,
  { blockId, sectionIndex, label }: SectionRef & { label: string },
): SequenceModel {
  return updateItem(model, blockId, (item: SequenceItem) =>
    blockPatch(item, (block: BlockItem) => ({
      sections: block.sections.map((section: Section, index: number) =>
        index === sectionIndex ? { ...section, label } : section,
      ),
    })),
  );
}

export function addSection(model: SequenceModel, blockId: string): SequenceModel {
  return updateItem(model, blockId, (item: SequenceItem) =>
    blockPatch(item, (block: BlockItem) => ({
      sections: [...block.sections, { label: defaultMoreLabel(block.kind), items: [] }],
    })),
  );
}

function withoutSection(block: BlockItem, sectionIndex: number): ItemPatch {
  const previous: Section | undefined = block.sections[sectionIndex - 1];
  const removed: Section | undefined = block.sections[sectionIndex];
  if (!previous || !removed) {
    return {};
  }
  const merged: Section = { ...previous, items: [...previous.items, ...removed.items] };
  return {
    sections: [
      ...block.sections.slice(0, sectionIndex - 1),
      merged,
      ...block.sections.slice(sectionIndex + 1),
    ],
  };
}

/** Removes a section; its items join the previous section. The first section stays. */
export function removeSection(
  model: SequenceModel,
  { blockId, sectionIndex }: SectionRef,
): SequenceModel {
  return updateItem(model, blockId, (item: SequenceItem) =>
    blockPatch(item, (block: BlockItem) => withoutSection(block, sectionIndex)),
  );
}

export function newMessage(
  from: string,
  to: string,
  extra: Partial<Omit<MessageItem, 't'>> = {},
): MessageItem {
  return {
    t: 'msg',
    id: newId(),
    from,
    to,
    text: '',
    line: 'solid',
    head: 'arrow',
    act: '',
    central: '',
    create: [],
    destroy: [],
    ...extra,
  };
}

export function newNote(
  actors: string[],
  placement: NotePlacement = 'right',
  text: string = 'Note',
): NoteItem {
  return { t: 'note', id: newId(), placement, actors, text };
}

function restarted(item: AutonumberItem, start: number | undefined): AutonumberItem {
  return {
    t: 'autonumber',
    id: item.id,
    isVisible: item.isVisible,
    ...(item.step === undefined ? {} : { step: item.step }),
    ...(start === undefined ? {} : { start }),
  };
}

/** Sets where an `autonumber` row restarts the count; undefined continues it. */
export function setAutonumberStart(
  model: SequenceModel,
  id: string,
  start: number | undefined,
): SequenceModel {
  return withItems(
    model,
    mapTree(model.items, (item: SequenceItem) =>
      item.id === id && item.t === 'autonumber' ? restarted(item, start) : item,
    ),
  );
}

export function toggleAutonumber(model: SequenceModel): SequenceModel {
  return { ...model, autonumber: model.autonumber ? null : { isVisible: true } };
}

/** Reverses a message's direction. */
export function reverseMessage(model: SequenceModel, id: string): SequenceModel {
  return updateItem(model, id, (item: SequenceItem) =>
    item.t === 'msg' ? { from: item.to, to: item.from } : {},
  );
}
