// Pure participant and box edits of the sequence model.
import { uniqueParticipantId, walkItems } from './model.ts';
import { fixLifecycle, normalizeOrder } from './ops.ts';
import { mapTree } from './tree.ts';

import type { ItemVisit } from './model.ts';
import type { Edited } from './ops.ts';
import type {
  Participant,
  ParticipantKind,
  SequenceBox,
  SequenceItem,
  SequenceModel,
} from './types.ts';

const ID_OK: RegExp = /^[\p{L}\p{N}_.]+$/u;

export interface NewParticipant {
  kind?: ParticipantKind;
  index?: number;
  label?: string;
}

function baseId(kind: ParticipantKind): string {
  if (kind === 'actor') {
    return 'Actor';
  }
  return kind === 'participant' ? 'P' : kind.charAt(0).toUpperCase() + kind.slice(1);
}

// The box between two neighbours, when both sit in the same one.
function sharedBox(
  previous: Participant | undefined,
  next: Participant | undefined,
): string | null {
  return previous?.box && previous.box === next?.box ? previous.box : null;
}

/** Adds a participant before any created ones. Joining the middle of a box puts it in that box. */
export function addParticipant(
  model: SequenceModel,
  { kind = 'participant', index = model.participants.length, label }: NewParticipant = {},
): Edited {
  const id: string = uniqueParticipantId(model, baseId(kind));
  const list: Participant[] = [...model.participants];
  const firstCreated: number = list.findIndex((participant: Participant) => participant.isCreated);
  const at: number = Math.min(index, firstCreated < 0 ? list.length : firstCreated);
  const box: string | null = sharedBox(list[at - 1], list[at]);
  list.splice(at, 0, { id, label: label ?? id, kind, box, isCreated: false });
  return { model: { ...model, participants: list }, id };
}

export function updateParticipant(
  model: SequenceModel,
  id: string,
  patch: Partial<Participant>,
): SequenceModel {
  return {
    ...model,
    participants: model.participants.map((participant: Participant) =>
      participant.id === id ? { ...participant, ...patch } : participant,
    ),
  };
}

/** Can `id` be a participant id? */
export function validParticipantId(id: string): boolean {
  return ID_OK.test(id);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renamedItem(item: SequenceItem, rename: (id: string) => string): SequenceItem {
  switch (item.t) {
    case 'msg':
      return {
        ...item,
        from: rename(item.from),
        to: rename(item.to),
        create: item.create.map(rename),
        destroy: item.destroy.map(rename),
      };
    case 'note':
      return { ...item, actors: item.actors.map(rename) };
    case 'act':
      return { ...item, actor: rename(item.actor) };
    default:
      return item;
  }
}

function renamedParticipant(participant: Participant, from: string, to: string): Participant {
  if (participant.id !== from) {
    return participant;
  }
  return { ...participant, id: to, label: participant.label === from ? to : participant.label };
}

/** Renames a participant everywhere. Unchanged when the new id is invalid or taken. */
export function renameParticipant(model: SequenceModel, from: string, to: string): SequenceModel {
  const isTaken: boolean = model.participants.some(
    (participant: Participant) => participant.id === to,
  );
  if (from === to || !validParticipantId(to) || isTaken) {
    return model;
  }
  const rename = (id: string): string => (id === from ? to : id);
  const line: RegExp = new RegExp(
    `^((?:links?|properties|details)\\s+)${escapeRegExp(from)}(\\s*:)`,
  );
  return {
    ...model,
    items: mapTree(model.items, (item: SequenceItem) => renamedItem(item, rename)),
    participants: model.participants.map((participant: Participant) =>
      renamedParticipant(participant, from, to),
    ),
    extra: model.extra.map((text: string) => text.replace(line, `$1${to}$2`)),
  };
}

function isReference(item: SequenceItem, id: string): boolean {
  switch (item.t) {
    case 'msg':
      return item.from === id || item.to === id;
    case 'note':
      return item.actors.length === 1 && item.actors[0] === id;
    case 'act':
      return item.actor === id;
    default:
      return false;
  }
}

/** How many items reference a participant (deleting it removes them). */
export function participantRefs(model: SequenceModel, id: string): number {
  let count: number = 0;
  walkItems(model.items, ({ item }: ItemVisit) => {
    count += isReference(item, id) ? 1 : 0;
  });
  return count;
}

function withoutParticipant(item: SequenceItem, id: string): SequenceItem | null {
  if (isReference(item, id)) {
    return null;
  }
  if (item.t === 'msg') {
    return { ...item, destroy: item.destroy.filter((destroyed: string) => destroyed !== id) };
  }
  return item.t === 'note'
    ? { ...item, actors: item.actors.filter((actor: string) => actor !== id) }
    : item;
}

function pruneBoxes(model: SequenceModel): SequenceModel {
  return {
    ...model,
    boxes: model.boxes.filter((box: SequenceBox) =>
      model.participants.some((participant: Participant) => participant.box === box.id),
    ),
  };
}

/** Deletes a participant with every item that references it. */
export function deleteParticipant(model: SequenceModel, id: string): SequenceModel {
  const line: RegExp = new RegExp(`^(?:links?|properties|details)\\s+${escapeRegExp(id)}\\s*:`);
  return pruneBoxes(
    fixLifecycle({
      ...model,
      items: mapTree(model.items, (item: SequenceItem) => withoutParticipant(item, id)),
      participants: model.participants.filter((participant: Participant) => participant.id !== id),
      extra: model.extra.filter((text: string) => !line.test(text)),
    }),
  );
}

function boxAfterMove(
  participant: Participant,
  previous: Participant | undefined,
  next: Participant | undefined,
): string | null {
  if (previous?.box && previous.box === next?.box) {
    return previous.box;
  }
  const hasLeftBox: boolean =
    participant.box !== null && previous?.box !== participant.box && next?.box !== participant.box;
  return hasLeftBox ? null : participant.box;
}

/** Moves a participant column to index `to`. Box membership follows the neighbours. */
export function moveParticipant(model: SequenceModel, id: string, to: number): SequenceModel {
  const from: number = model.participants.findIndex(
    (participant: Participant) => participant.id === id,
  );
  const participant: Participant | undefined = model.participants[from];
  if (!participant || participant.isCreated) {
    return model;
  }
  const list: Participant[] = model.participants.filter((other: Participant) => other.id !== id);
  const at: number = Math.max(0, Math.min(to > from ? to - 1 : to, list.length));
  list.splice(at, 0, { ...participant, box: boxAfterMove(participant, list[at - 1], list[at]) });
  return pruneBoxes(normalizeOrder({ ...model, participants: list }));
}

function withNewBox(model: SequenceModel): { model: SequenceModel; boxId: string } {
  const used: Set<string> = new Set<string>(model.boxes.map((box: SequenceBox) => box.id));
  let index: number = 1;
  while (used.has(`box${String(index)}`)) {
    index++;
  }
  const boxId: string = `box${String(index)}`;
  return {
    model: { ...model, boxes: [...model.boxes, { id: boxId, name: 'Group', fill: 'transparent' }] },
    boxId,
  };
}

function lastMemberIndex(list: readonly Participant[], boxId: string | null): number {
  return list.reduce(
    (last: number, participant: Participant, index: number) =>
      boxId !== null && participant.box === boxId ? index : last,
    -1,
  );
}

// Joining a box: after its last member. Leaving: step out past the box's last member.
function boxSlot(model: SequenceModel, participant: Participant, boxId: string | null): number {
  const list: Participant[] = model.participants.filter(
    (other: Participant) => other.id !== participant.id,
  );
  const original: number = model.participants.indexOf(participant);
  if (boxId) {
    const last: number = lastMemberIndex(list, boxId);
    return last >= 0 ? last + 1 : original;
  }
  const last: number = lastMemberIndex(list, participant.box);
  return last >= 0 && last >= original ? last + 1 : original;
}

function targetBox(
  model: SequenceModel,
  boxId: string | null,
): { model: SequenceModel; boxId: string | null } {
  if (boxId === 'new') {
    return withNewBox(model);
  }
  return { model, boxId: boxId === '' ? null : boxId };
}

/** Puts a participant in a box ('new' makes one, null takes it out). Members stay contiguous. */
export function setParticipantBox(
  model: SequenceModel,
  id: string,
  boxId: string | null,
): SequenceModel {
  const participant: Participant | undefined = model.participants.find(
    (candidate: Participant) => candidate.id === id,
  );
  if (!participant || participant.isCreated) {
    return model;
  }
  const created: { model: SequenceModel; boxId: string | null } = targetBox(model, boxId);
  const list: Participant[] = created.model.participants.filter(
    (other: Participant) => other.id !== id,
  );
  const at: number = boxSlot(created.model, participant, created.boxId);
  list.splice(Math.min(at, list.length), 0, { ...participant, box: created.boxId });
  return pruneBoxes(normalizeOrder({ ...created.model, participants: list }));
}

export function updateBox(
  model: SequenceModel,
  id: string,
  patch: Partial<SequenceBox>,
): SequenceModel {
  return {
    ...model,
    boxes: model.boxes.map((box: SequenceBox) => (box.id === id ? { ...box, ...patch } : box)),
  };
}

/** Removes a box; its members stay, outside any box. */
export function removeBox(model: SequenceModel, id: string): SequenceModel {
  return pruneBoxes({
    ...model,
    participants: model.participants.map((participant: Participant) =>
      participant.box === id ? { ...participant, box: null } : participant,
    ),
  });
}
