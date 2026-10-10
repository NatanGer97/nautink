import { noteLines, readable } from '@nautink/editors/class/text';
import { cn } from '@nautink/ui/lib/utils';
import { memo } from 'react';

import { useClassNodeContext } from './class-context.ts';
import { ClassHandles } from './class-handles.tsx';
import { FRAME_PREFIX } from './class-types.ts';
import { InlineEditor } from './inline-editor.tsx';

import type { FrameFlowNode, LolliFlowNode, NoteFlowNode } from './class-types.ts';
import type { NodeProps } from '@xyflow/react';
import type { NamedExoticComponent, ReactElement } from 'react';

const FOLD: number = 12;
const EDGE_INSET: number = 0.75;

function NoteShape({
  width,
  height,
  isSelected,
}: {
  width: number;
  height: number;
  isSelected: boolean;
}): ReactElement {
  const right: number = width - EDGE_INSET;
  const bottom: number = height - EDGE_INSET;
  const stroke: string = isSelected
    ? 'stroke-accent-ink [stroke-width:2]'
    : 'stroke-warning [stroke-width:1.2]';
  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      className="absolute inset-0 overflow-visible"
    >
      <path
        className={cn('fill-warning-bg', stroke)}
        d={`M${String(EDGE_INSET)},${String(EDGE_INSET)} H${String(width - FOLD)} L${String(right)},${String(FOLD)} V${String(bottom)} H${String(EDGE_INSET)} Z`}
      />
      <path
        className={cn('fill-none', stroke)}
        d={`M${String(width - FOLD)},${String(EDGE_INSET)} V${String(FOLD)} H${String(right)}`}
      />
    </svg>
  );
}

function NoteText({ id, text }: { id: string; text: string }): ReactElement {
  const { editing, setEditing, setNoteText, isReadOnly } = useClassNodeContext();
  if (!isReadOnly && editing?.id === id && editing.part === 'note') {
    return (
      <div className="relative px-2.5 py-1.5">
        <InlineEditor
          label="Note text"
          isMultiline
          value={noteLines(text).join('\n')}
          className="resize-none text-xs leading-[17px]"
          onDone={(next) => {
            setEditing(null);
            if (next !== null) {
              setNoteText(id, next);
            }
          }}
        />
      </div>
    );
  }
  return (
    <div className="relative truncate py-2.5 pr-[18px] pl-2.5 text-xs leading-[17px] whitespace-nowrap">
      {noteLines(text).map((line, index) => (
        // Lines have no identity of their own; their order is the key.
        <div key={String(index)} className="truncate">
          {line === '' ? ' ' : line}
        </div>
      ))}
    </div>
  );
}

function NoteNodeView({ id, data, selected: isSelected }: NodeProps<NoteFlowNode>): ReactElement {
  const { width, height } = data.size;
  return (
    <div
      data-testid={`class-note-${id}`}
      aria-label="Note"
      className="relative text-foreground"
      style={{ width, height }}
    >
      <NoteShape width={width} height={height} isSelected={isSelected} />
      <NoteText id={id} text={data.note.text} />
      <ClassHandles />
    </div>
  );
}

/** A note with a folded corner (v1's NoteNode); double-click edits its text in place. */
export const NoteNode: NamedExoticComponent<NodeProps<NoteFlowNode>> = memo(NoteNodeView);

function LolliNodeView({ data, selected: isSelected }: NodeProps<LolliFlowNode>): ReactElement {
  return (
    <div aria-label={`Interface ${readable(data.label)}`} className="relative size-[22px]">
      <div
        className={cn(
          'absolute inset-0.5 rounded-full border-[1.5px] border-edge bg-panel',
          isSelected && 'border-accent-ink',
        )}
      />
      <div className="absolute top-1/2 left-full ml-1 -translate-y-1/2 text-2xs whitespace-nowrap text-foreground">
        {readable(data.label)}
      </div>
      <ClassHandles />
    </div>
  );
}

/** A lollipop interface's circle and label (v1's LolliNode). */
export const LolliNode: NamedExoticComponent<NodeProps<LolliFlowNode>> = memo(LolliNodeView);

function NamespaceFrameView({
  id,
  data,
  selected: isSelected,
}: NodeProps<FrameFlowNode>): ReactElement {
  return (
    <div
      data-testid={`class-namespace-${id.slice(FRAME_PREFIX.length)}`}
      aria-label={`Namespace ${data.title}`}
      className={cn(
        'rounded-card border border-dashed border-node-stroke bg-muted/40',
        isSelected && 'border-solid border-accent-ink',
      )}
      style={{ width: data.width, height: data.height }}
    >
      <div className="flex items-baseline gap-1.5 truncate px-2.5 pt-1 text-xs font-medium text-muted-foreground">
        <span className="font-normal text-faint">namespace</span>
        {readable(data.title)}
      </div>
    </div>
  );
}

/** A namespace's frame around its content; dragging it moves the content (v1's NsFrame). */
export const NamespaceFrame: NamedExoticComponent<NodeProps<FrameFlowNode>> =
  memo(NamespaceFrameView);
