import { BLOCKS, KIND_NAMES, KINDS } from '@nautink/editors/sequence/constants';

import { blockDragData, participantDragData, SEQUENCE_DRAG_TYPE } from './sequence-drop.ts';
import { KindIcon } from './sequence-glyphs.tsx';
import { LibraryItem, LibraryPanel } from '../library/library-panel.tsx';

import type { BlockKind, ParticipantKind } from '@nautink/editors/sequence/types';
import type { ReactElement } from 'react';

export type SequenceLibraryTab = 'participants' | 'blocks';

/** The blocks v1's palette offered (`par over` is reached from a block's kind). */
export const WRAP_KINDS: readonly BlockKind[] = [
  'loop',
  'alt',
  'opt',
  'par',
  'critical',
  'break',
  'rect',
];

const BLOCK_HINTS: Readonly<Partial<Record<BlockKind, string>>> = {
  loop: 'Repeats',
  alt: 'Either or',
  opt: 'Optional',
  par: 'In parallel',
  critical: 'Must succeed',
  break: 'Stops the flow',
  rect: 'Highlight',
};

function BlockIcon(): ReactElement {
  return (
    <svg
      aria-hidden="true"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      className="fill-none stroke-current [stroke-width:1.4]"
    >
      <rect x="2.5" y="5" width="19" height="14" rx="1" />
      <path d="M2.5,5 H10 V8 L8.5,9.5 H2.5" className="fill-muted" />
    </svg>
  );
}

interface PickProps {
  isReadOnly: boolean;
  onAddParticipant: (kind: ParticipantKind) => void;
  onAddBlock: (kind: BlockKind) => void;
}

function ParticipantsTab({ isReadOnly, onAddParticipant }: PickProps): ReactElement {
  return (
    <div className="grid grid-cols-3 gap-1 overflow-y-auto p-2">
      {KINDS.map((kind) => (
        <LibraryItem
          key={kind}
          title={KIND_NAMES[kind]}
          caption={KIND_NAMES[kind]}
          isDisabled={isReadOnly}
          dragType={SEQUENCE_DRAG_TYPE}
          dragData={participantDragData(kind)}
          onPick={() => {
            onAddParticipant(kind);
          }}
        >
          <KindIcon kind={kind} size={24} />
        </LibraryItem>
      ))}
    </div>
  );
}

function BlocksTab({ isReadOnly, onAddBlock }: PickProps): ReactElement {
  return (
    <div className="flex min-h-0 flex-col overflow-y-auto">
      <p className="px-3 pt-2.5 text-xs text-muted-foreground">
        Wraps the selected rows, or adds an empty block.
      </p>
      <div className="grid grid-cols-3 gap-1 p-2">
        {WRAP_KINDS.map((kind) => (
          <LibraryItem
            key={kind}
            title={`${BLOCKS[kind].name}: ${BLOCK_HINTS[kind] ?? ''}`}
            caption={BLOCKS[kind].name}
            isDisabled={isReadOnly}
            dragType={SEQUENCE_DRAG_TYPE}
            dragData={blockDragData(kind)}
            onPick={() => {
              onAddBlock(kind);
            }}
          >
            <BlockIcon />
          </LibraryItem>
        ))}
      </div>
    </div>
  );
}

export interface SequenceLibraryProps extends PickProps {
  tab: SequenceLibraryTab;
  onTabChange: (tab: SequenceLibraryTab) => void;
  onClose: () => void;
}

/** The sequence library: every participant kind, and the blocks; click adds, drag drops in place. */
export function SequenceLibrary({
  tab,
  onTabChange,
  onClose,
  ...pick
}: SequenceLibraryProps): ReactElement {
  return (
    <LibraryPanel
      activeTab={tab}
      onTabChange={(id) => {
        onTabChange(id === 'blocks' ? 'blocks' : 'participants');
      }}
      onClose={onClose}
      tabs={[
        { id: 'participants', label: 'Participants', content: <ParticipantsTab {...pick} /> },
        { id: 'blocks', label: 'Blocks', content: <BlocksTab {...pick} /> },
      ]}
    />
  );
}
