// The sequence selection: what survives an outside change, clicks with Shift, what a drag moves,
// and what the app-wide selection store hears about it.
import { findItem } from '@nautink/editors/sequence/model';
import { rangeBetween, siblingRange } from '@nautink/editors/sequence/tree';
import { clip } from '@nautink/visual-core/text';

import { boxName, itemName, participantName } from './sequence-names.ts';
import { itemSelection, NO_SELECTION } from './sequence-types.ts';

import type { SequenceSelection } from './sequence-types.ts';
import type { SelectedItem } from '../selection/canvas-selection.ts';
import type { SequenceItem, SequenceModel } from '@nautink/editors/sequence/types';

const TEXT_CLIP: number = 40;

function hasParticipant(model: SequenceModel, id: string): boolean {
  return model.participants.some((participant) => participant.id === id);
}

function liveIds(model: SequenceModel, selection: SequenceSelection): string[] {
  switch (selection.kind) {
    case 'participant':
      return selection.ids.filter((id) => hasParticipant(model, id));
    case 'box':
      return selection.ids.filter((id) => model.boxes.some((box) => box.id === id));
    case 'items':
      return selection.ids.filter((id) => findItem(model, id) !== null);
    default:
      return [];
  }
}

/** Drops what an outside change removed (an undo, Claude, typing). */
export function liveSelection(
  selection: SequenceSelection,
  model: SequenceModel | null,
): SequenceSelection {
  if (model === null) {
    return NO_SELECTION;
  }
  const ids: string[] = liveIds(model, selection);
  if (ids.length === 0) {
    return NO_SELECTION;
  }
  return ids.length === selection.ids.length ? selection : { ...selection, ids };
}

const ITEM_KINDS: Readonly<Record<SequenceItem['t'], string>> = {
  msg: 'message',
  note: 'note',
  act: 'activation',
  autonumber: 'autonumber',
  block: 'block',
};

function selectedRow(model: SequenceModel, id: string): SelectedItem {
  const item: SequenceItem | undefined = findItem(model, id)?.item;
  const text: string = item?.t === 'msg' || item?.t === 'note' ? item.text : '';
  const name: string = itemName(model, id);
  return {
    id,
    label: text === '' ? name : `${name}: ${clip(text, TEXT_CLIP)}`,
    kind: item === undefined ? 'item' : ITEM_KINDS[item.t],
  };
}

/**
 * The selection as the app-wide store keeps it. Participants carry their Mermaid id, so Split
 * finds them in the render; rows and boxes have no Mermaid id, so their label says what they are.
 */
export function selectedItems(
  model: SequenceModel | null,
  selection: SequenceSelection,
): SelectedItem[] {
  if (model === null) {
    return [];
  }
  return selection.ids.map((id) => {
    if (selection.kind === 'participant') {
      return { id, label: participantName(model, id), kind: 'participant' };
    }
    return selection.kind === 'box'
      ? { id, label: boxName(model, id), kind: 'box' }
      : selectedRow(model, id);
  });
}

/** The selection for Mermaid ids picked elsewhere (a participant clicked in Split's preview). */
export function selectionOfIds(
  model: SequenceModel | null,
  ids: readonly string[],
): SequenceSelection {
  const found: string[] = model === null ? [] : ids.filter((id) => hasParticipant(model, id));
  return found.length === 0 ? NO_SELECTION : { kind: 'participant', ids: found };
}

/** A click on a row: selects it, or with Shift the rows from the anchor to it (v1). */
export function clickedRow(
  model: SequenceModel,
  selection: SequenceSelection,
  click: { id: string; isShift: boolean },
): SequenceSelection {
  const anchor: string | undefined = selection.kind === 'items' ? selection.anchor : undefined;
  if (click.isShift && anchor !== undefined) {
    return itemSelection(rangeBetween(model, anchor, click.id), anchor);
  }
  return itemSelection([click.id], click.id);
}

/** What a drag that starts on a row moves: the selected neighbours, when it is one of them. */
export function draggedRows(
  model: SequenceModel,
  selection: SequenceSelection,
  id: string,
): readonly string[] {
  const isGroup: boolean =
    selection.kind === 'items' &&
    selection.ids.length > 1 &&
    selection.ids.includes(id) &&
    siblingRange(model, selection.ids) !== null;
  return isGroup ? selection.ids : [id];
}
