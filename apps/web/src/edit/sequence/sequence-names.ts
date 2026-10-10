// Names in step labels and the selection store (v1's `pName`, `itemName`, `rows`).
import { BLOCKS } from '@nautink/editors/sequence/constants';
import { findItem } from '@nautink/editors/sequence/model';
import { clip } from '@nautink/visual-core/text';

import type {
  Participant,
  SequenceBox,
  SequenceItem,
  SequenceModel,
} from '@nautink/editors/sequence/types';

const NAME_CLIP: number = 24;

/** A participant's display name (its label, else its id), clipped. */
export function participantName(model: SequenceModel, id: string): string {
  const participant: Participant | undefined = model.participants.find((item) => item.id === id);
  return clip(
    participant?.label === undefined || participant.label === '' ? id : participant.label,
    NAME_CLIP,
  );
}

/** "1 row", "3 rows". */
export function rowsLabel(count: number): string {
  return `${String(count)} ${count === 1 ? 'row' : 'rows'}`;
}

function nameOf(model: SequenceModel, item: SequenceItem): string {
  switch (item.t) {
    case 'msg':
      return `message ${participantName(model, item.from)} → ${participantName(model, item.to)}`;
    case 'note':
      return `note on ${item.actors.map((actor) => participantName(model, actor)).join(', ')}`;
    case 'act':
      return `${item.isOn ? 'activation' : 'deactivation'} of ${participantName(model, item.actor)}`;
    case 'autonumber':
      return 'autonumber';
    default:
      return `${BLOCKS[item.kind].name.toLowerCase()} block`;
  }
}

/** "message Alice → Bob", "note on Alice", "loop block"; "item" when there is no such item. */
export function itemName(model: SequenceModel, id: string): string {
  const item: SequenceItem | undefined = findItem(model, id)?.item;
  return item === undefined ? 'item' : nameOf(model, item);
}

/** The box's title, else its color, else its id. */
export function boxName(model: SequenceModel, id: string): string {
  const box: SequenceBox | undefined = model.boxes.find((item) => item.id === id);
  const fill: string = box === undefined || box.fill === 'transparent' ? '' : box.fill;
  const name: string = [box?.name ?? '', fill].find((text) => text !== '') ?? id;
  return clip(name, NAME_CLIP);
}
