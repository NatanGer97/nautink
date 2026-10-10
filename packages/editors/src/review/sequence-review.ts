// A sequence diagram as review elements: participants, messages, notes and blocks. Rows have no
// Mermaid id, so the merged diagram keeps removed rows where they stood (a longest common
// subsequence of the two row lists, block by block).
import { removedRefs, signature } from './review-element.ts';
import { sequenceEditor, walkItems } from '../sequence/model.ts';

import type { ReviewAdapter } from './review-adapter.ts';
import type { ReviewElement } from './review-element.ts';
import type { ItemVisit } from '../sequence/model.ts';
import type {
  BlockItem,
  Participant,
  Section,
  SequenceItem,
  SequenceModel,
} from '../sequence/types.ts';

function participantElement(participant: Participant): ReviewElement {
  const { id, ...fields } = participant;
  return {
    id,
    kind: 'participant',
    key: `participant:${id}`,
    sig: signature(fields),
    label: participant.label || id,
  };
}

/** A row's identity: what has to match for two rows to be the same row. */
export function rowKey(item: SequenceItem): string {
  switch (item.t) {
    case 'msg':
      return `message:${item.from}>${item.to}`;
    case 'note':
      return `note:${item.placement}:${item.actors.join(',')}`;
    case 'block':
      return `block:${item.kind}`;
    case 'act':
      return `activation:${item.actor}:${String(item.isOn)}`;
    case 'autonumber':
      return 'autonumber';
  }
}

/** Messages, notes and blocks are reviewed; activations and autonumber rows are not. */
function rowElement(item: SequenceItem): ReviewElement[] {
  const { id } = item;
  const key: string = rowKey(item);
  const sig: string = signature({ ...item, id: undefined });
  if (item.t === 'msg') {
    return [{ id, kind: 'message', key, sig, label: item.text, ends: [item.from, item.to] }];
  }
  if (item.t === 'note') {
    return [{ id, kind: 'note', key, sig, label: item.text }];
  }
  if (item.t !== 'block') {
    return [];
  }
  const labels: string[] = item.sections.map((section: Section) => section.label);
  return [
    { id, kind: 'group', key, sig: signature(labels), label: labels.join(' / ') || item.kind },
  ];
}

/** Participants, then every message, note and block, depth first in source order. */
export function sequenceElements(model: SequenceModel): ReviewElement[] {
  const rows: ReviewElement[] = [];
  walkItems(model.items, ({ item }: ItemVisit) => {
    rows.push(...rowElement(item));
  });
  return [...model.participants.map(participantElement), ...rows];
}

type CommonLength = (i: number, j: number) => number;

/** The length of the longest common subsequence of `before[i..]` and `after[j..]`. */
function commonLengths(before: readonly string[], after: readonly string[]): CommonLength {
  const cells: Map<string, number> = new Map<string, number>();
  const at: CommonLength = (i: number, j: number): number =>
    cells.get(`${String(i)},${String(j)}`) ?? 0;
  for (let i: number = before.length - 1; i >= 0; i--) {
    for (let j: number = after.length - 1; j >= 0; j--) {
      const length: number =
        before[i] === after[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
      cells.set(`${String(i)},${String(j)}`, length);
    }
  }
  return at;
}

/** A ghost must not change who is active, created or destroyed, so those parts are dropped. */
function inert(item: SequenceItem): SequenceItem[] {
  switch (item.t) {
    case 'msg':
      return [{ ...item, act: '', create: [], destroy: [] }];
    case 'block':
      return [
        {
          ...item,
          sections: item.sections.map((section: Section) => ({
            ...section,
            items: section.items.flatMap(inert),
          })),
        },
      ];
    case 'note':
      return [item];
    default:
      return [];
  }
}

function ghostRow(item: SequenceItem, removed: ReadonlySet<string>): SequenceItem[] {
  return removed.has(item.id) ? inert(item) : [];
}

interface MergeContext {
  /** Ids of removed messages, notes and blocks. */
  removed: ReadonlySet<string>;
}

function mergePair(before: SequenceItem, after: SequenceItem, context: MergeContext): SequenceItem {
  if (before.t !== 'block' || after.t !== 'block') {
    return after;
  }
  return { ...after, sections: mergeSections(before, after, context) };
}

function mergeSections(before: BlockItem, after: BlockItem, context: MergeContext): Section[] {
  return after.sections.map((section: Section, index: number) => ({
    ...section,
    items: mergeRows(before.sections[index]?.items ?? [], section.items, context),
  }));
}

type AlignStep = 'both' | 'before' | 'after';

interface AlignWalk {
  keysBefore: readonly string[];
  keysAfter: readonly string[];
  length: CommonLength;
}

function isSameRow({ keysBefore, keysAfter }: AlignWalk, i: number, j: number): boolean {
  return i < keysBefore.length && j < keysAfter.length && keysBefore[i] === keysAfter[j];
}

function stepAt(walk: AlignWalk, i: number, j: number): AlignStep {
  if (isSameRow(walk, i, j)) {
    return 'both';
  }
  const { keysBefore, keysAfter, length } = walk;
  const canTakeBefore: boolean = i < keysBefore.length;
  const isBeforeBetter: boolean = j >= keysAfter.length || length(i + 1, j) >= length(i, j + 1);
  return canTakeBefore && isBeforeBetter ? 'before' : 'after';
}

/** The walk through both row lists along their longest common subsequence of keys. */
export function alignRows(keysBefore: string[], keysAfter: string[]): AlignStep[] {
  const walk: AlignWalk = { keysBefore, keysAfter, length: commonLengths(keysBefore, keysAfter) };
  const steps: AlignStep[] = [];
  let i: number = 0;
  let j: number = 0;
  while (i < keysBefore.length || j < keysAfter.length) {
    const step: AlignStep = stepAt(walk, i, j);
    steps.push(step);
    i += step === 'after' ? 0 : 1;
    j += step === 'before' ? 0 : 1;
  }
  return steps;
}

/** `after`'s rows with `before`'s removed rows kept in place between them. */
function mergeRows(
  before: readonly SequenceItem[],
  after: readonly SequenceItem[],
  context: MergeContext,
): SequenceItem[] {
  let i: number = 0;
  let j: number = 0;
  return alignRows(before.map(rowKey), after.map(rowKey)).flatMap((step: AlignStep) => {
    const old: SequenceItem[] = step === 'after' ? [] : before.slice(i, ++i);
    const next: SequenceItem[] = step === 'before' ? [] : after.slice(j, ++j);
    return mergeStep(old[0], next[0], context);
  });
}

function mergeStep(
  old: SequenceItem | undefined,
  next: SequenceItem | undefined,
  context: MergeContext,
): SequenceItem[] {
  if (next === undefined) {
    return old === undefined ? [] : ghostRow(old, context.removed);
  }
  return [old === undefined ? next : mergePair(old, next, context)];
}

function ghostParticipants(
  before: SequenceModel,
  after: SequenceModel,
  removed: ReadonlySet<string>,
): Participant[] {
  const boxes: Set<string> = new Set<string>(after.boxes.map((box) => box.id));
  return before.participants
    .filter((participant) => removed.has(`participant:${participant.id}`))
    .map((participant) => ({
      ...participant,
      isCreated: false,
      box: participant.box !== null && boxes.has(participant.box) ? participant.box : null,
    }));
}

/** The proposal plus what it removed: participants (never created by a message) and rows. */
export function sequenceUnion(before: SequenceModel, after: SequenceModel): SequenceModel {
  const removed: Set<string> = removedRefs(sequenceElements(before), sequenceElements(after));
  const rows: Set<string> = new Set<string>(
    [...removed]
      .filter((ref: string) => !ref.startsWith('participant:'))
      .map((ref: string) => ref.slice(ref.indexOf(':') + 1)),
  );
  return {
    ...after,
    participants: [...after.participants, ...ghostParticipants(before, after, removed)],
    items: mergeRows(before.items, after.items, { removed: rows }),
  };
}

export const sequenceReview: ReviewAdapter<SequenceModel> = {
  module: sequenceEditor,
  elements: sequenceElements,
  union: sequenceUnion,
};
