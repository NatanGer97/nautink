import { findItem } from '@nautink/editors/sequence/model';

import { BlockPanel } from './block-panel.tsx';
import { MessagePanel } from './message-panel.tsx';
import { BoxPanel, ParticipantPanel } from './participant-panel.tsx';
import { ActivationPanel, AutonumberPanel, NotePanel, RowsPanel } from './row-panels.tsx';

import type { SequenceActionContext } from './sequence-actions.ts';
import type { SequenceSelection } from './sequence-types.ts';
import type {
  Participant,
  SequenceBox,
  SequenceItem,
  SequenceModel,
} from '@nautink/editors/sequence/types';
import type { ReactElement } from 'react';

export interface SequenceInspectorProps {
  model: SequenceModel;
  selection: SequenceSelection;
  context: SequenceActionContext;
  isReadOnly: boolean;
}

type PanelProps = Omit<SequenceInspectorProps, 'selection'>;

function RowPanel({ item, ...props }: PanelProps & { item: SequenceItem }): ReactElement {
  switch (item.t) {
    case 'msg':
      return <MessagePanel {...props} message={item} />;
    case 'note':
      return <NotePanel {...props} note={item} />;
    case 'act':
      return <ActivationPanel {...props} item={item} />;
    case 'autonumber':
      return <AutonumberPanel {...props} item={item} />;
    default:
      return <BlockPanel {...props} block={item} />;
  }
}

function ItemsPanel({
  ids,
  ...props
}: PanelProps & { ids: readonly string[] }): ReactElement | null {
  const [only] = ids;
  if (ids.length > 1 || only === undefined) {
    return ids.length > 1 ? <RowsPanel {...props} ids={ids} /> : null;
  }
  const item: SequenceItem | undefined = findItem(props.model, only)?.item;
  return item === undefined ? null : <RowPanel {...props} item={item} />;
}

/**
 * The floating inspector (M1), shown only while something is selected: one participant, a box,
 * one row of any kind, or several rows (v1's Inspector). Its fields write labelled undo steps.
 */
export function SequenceInspector({
  selection,
  ...props
}: SequenceInspectorProps): ReactElement | null {
  const [only] = selection.ids;
  if (selection.kind === 'items') {
    return <ItemsPanel {...props} ids={selection.ids} />;
  }
  if (selection.kind === 'participant' && selection.ids.length === 1) {
    const participant: Participant | undefined = props.model.participants.find(
      (item) => item.id === only,
    );
    return participant === undefined ? null : (
      <ParticipantPanel {...props} participant={participant} />
    );
  }
  if (selection.kind === 'box') {
    const box: SequenceBox | undefined = props.model.boxes.find((item) => item.id === only);
    return box === undefined ? null : <BoxPanel {...props} box={box} />;
  }
  return null;
}
