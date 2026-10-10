import { BLOCKS } from '@nautink/editors/sequence/constants';
import { IconButton } from '@nautink/ui/icon-button';
import { X } from 'lucide-react';

import {
  addSection,
  removeSection,
  setBlockKind,
  setSectionLabel,
  unwrapBlock,
} from './sequence-actions.ts';
import { ColorField } from './sequence-inspector-parts.tsx';
import { deleteSelection } from './sequence-moves.ts';
import { InspectorActions, InspectorButton, InspectorCard } from '../canvas/inspector-card.tsx';
import { CommitField, SelectField } from '../canvas/inspector-fields.tsx';

import type { SequenceActionContext } from './sequence-actions.ts';
import type { SelectOption } from '../canvas/inspector-fields.tsx';
import type { BlockItem, BlockKind } from '@nautink/editors/sequence/types';
import type { ReactElement } from 'react';

const RECT_FILL: string = 'rgba(127, 127, 255, 0.15)';

const KIND_OPTIONS: readonly SelectOption[] = Object.entries(BLOCKS).map(([value, { name }]) => ({
  value,
  label: name,
}));

function isBlockKind(value: string): value is BlockKind {
  return Object.hasOwn(BLOCKS, value);
}

interface BlockPanelProps {
  block: BlockItem;
  context: SequenceActionContext;
  isReadOnly: boolean;
}

function SectionFields({ block, context }: Omit<BlockPanelProps, 'isReadOnly'>): ReactElement {
  const more: string = BLOCKS[block.kind].more ?? 'else';
  return (
    <>
      {block.sections.map((section, index) => (
        // Sections have no ids: their place in the block is who they are.
        <div key={`${block.id}:${String(index)}`} className="flex items-end gap-1">
          <div className="min-w-0 flex-1">
            <CommitField
              label={index === 0 ? 'Condition' : `${more} ${String(index)}`}
              value={section.label}
              placeholder="None"
              onCommit={(label) => {
                setSectionLabel(context, { blockId: block.id, sectionIndex: index, label });
              }}
            />
          </div>
          {index === 0 ? null : (
            <IconButton
              label={`Remove this ${more} (its rows join the section above)`}
              icon={<X />}
              className="size-8"
              onClick={() => {
                removeSection(context, { blockId: block.id, sectionIndex: index });
              }}
            />
          )}
        </div>
      ))}
    </>
  );
}

/** A block: its kind, its conditions (or color for `rect`), sections, unwrap and delete. */
export function BlockPanel({ block, context, isReadOnly }: BlockPanelProps): ReactElement {
  const more: string | null = BLOCKS[block.kind].more;
  return (
    <InspectorCard title="Block" subtitle={block.kind} isReadOnly={isReadOnly}>
      <SelectField
        label="Kind"
        value={block.kind}
        groups={[{ label: 'Blocks', options: KIND_OPTIONS }]}
        onChange={(kind) => {
          if (isBlockKind(kind)) {
            setBlockKind(context, block.id, kind);
          }
        }}
      />
      {block.kind === 'rect' ? (
        <ColorField
          label="Background"
          value={block.sections[0]?.label ?? ''}
          onCommit={(color) => {
            setSectionLabel(context, {
              blockId: block.id,
              sectionIndex: 0,
              label: color || RECT_FILL,
            });
          }}
        />
      ) : (
        <SectionFields block={block} context={context} />
      )}
      {more === null ? null : (
        <InspectorButton
          onClick={() => {
            addSection(context, block.id);
          }}
        >
          Add {more}
        </InspectorButton>
      )}
      <InspectorActions>
        <InspectorButton
          onClick={() => {
            unwrapBlock(context, block.id);
          }}
        >
          Unwrap
        </InspectorButton>
        <InspectorButton
          isDestructive
          onClick={() => {
            deleteSelection(context);
          }}
        >
          Delete with rows
        </InspectorButton>
      </InspectorActions>
    </InspectorCard>
  );
}
