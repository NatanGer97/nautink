import { ListOrdered, MoveRight, StickyNote } from 'lucide-react';

import { NOTE_DRAG_DATA, participantDragData, SEQUENCE_DRAG_TYPE } from './sequence-drop.ts';
import { KindIcon } from './sequence-glyphs.tsx';
import {
  EditorToolbar,
  ToolbarHelp,
  ToolbarIconButton,
  ToolbarSeparator,
  ToolbarTextButton,
} from '../canvas/editor-toolbar.tsx';

import type { ParticipantKind } from '@nautink/editors/sequence/types';
import type { DragEvent, ReactElement } from 'react';

/** v1's "How to use" tips. Undo and redo are the top bar's (PRD §3.4). */
export const SEQUENCE_TIPS: readonly string[] = [
  'Add participants from the toolbar or the library; drag a header sideways to reorder',
  'Drag from one lifeline to another to add a message; drop on the same lifeline for a self message',
  'Drag a message, note or block up or down to move it, or use ↑ ↓; ← → move a participant',
  'Shift-click rows to select a range, then wrap it in a loop, alt or another block',
  'Double-click text, or press Enter, to edit it in place',
  'Delete or Backspace removes; ⇧1 fits the diagram; ⌘Z and ⌘⇧Z undo and redo',
];

export interface SequenceToolbarProps {
  isReadOnly: boolean;
  hasParticipants: boolean;
  isNumbered: boolean;
  isLibraryOpen: boolean;
  onAddParticipant: (kind: ParticipantKind) => void;
  onAddMessage: () => void;
  onAddNote: () => void;
  onToggleNumbers: () => void;
  onLibrary: () => void;
}

function dragData(data: string): (event: DragEvent<HTMLButtonElement>) => void {
  return (event: DragEvent<HTMLButtonElement>): void => {
    event.dataTransfer.setData(SEQUENCE_DRAG_TYPE, data);
  };
}

/**
 * The canvas toolbar (M1): participants and actors (click, or drag onto the canvas), a message, a
 * note, the library with every participant kind and block, and autonumber. No undo or redo here.
 */
export function SequenceToolbar(props: SequenceToolbarProps): ReactElement {
  const isRowDisabled: boolean = props.isReadOnly || !props.hasParticipants;
  return (
    <EditorToolbar>
      {(['participant', 'actor'] as const).map((kind) => (
        <ToolbarIconButton
          key={kind}
          label={kind === 'actor' ? 'Add actor' : 'Add participant'}
          icon={<KindIcon kind={kind} />}
          isDisabled={props.isReadOnly}
          onClick={() => {
            props.onAddParticipant(kind);
          }}
          onDragStart={dragData(participantDragData(kind))}
        />
      ))}
      <ToolbarSeparator />
      <ToolbarIconButton
        label="Add message"
        icon={<MoveRight />}
        isDisabled={isRowDisabled}
        onClick={props.onAddMessage}
      />
      <ToolbarIconButton
        label="Add note"
        icon={<StickyNote />}
        isDisabled={isRowDisabled}
        onClick={props.onAddNote}
        onDragStart={dragData(NOTE_DRAG_DATA)}
      />
      <ToolbarIconButton
        label="Number the messages (autonumber)"
        icon={<ListOrdered />}
        isActive={props.isNumbered}
        isDisabled={props.isReadOnly}
        onClick={props.onToggleNumbers}
      />
      <ToolbarSeparator />
      <ToolbarTextButton isPressed={props.isLibraryOpen} onClick={props.onLibrary}>
        Library
      </ToolbarTextButton>
      <ToolbarHelp tips={SEQUENCE_TIPS} />
    </EditorToolbar>
  );
}
