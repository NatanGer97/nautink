import { nodeSize } from '@nautink/editors/state/size';
import { cn } from '@nautink/ui/lib/utils';
import { memo } from 'react';

import { LabelEditor, StateHandles, useInlineEdit } from './state-label-editor.tsx';

import type { CompositeFlowNode, RegionFlowNode, StateLeafNode } from './state-types.ts';
import type { LeafData } from '@nautink/editors/state/size';
import type { Size } from '@nautink/visual-core/geometry';
import type { NodeProps } from '@xyflow/react';
import type { NamedExoticComponent, ReactElement } from 'react';

const HALF: number = 0.5;
const SELECTED_BOX: string = 'border-accent-ink ring-[3px] ring-selection-ring';
const NOTE_FOLD: number = 10;
const END_RING_INSET: number = 1.5;
const END_DOT_INSET: number = 6;

function Lines({
  lines,
  className,
}: {
  lines: readonly string[];
  className: string;
}): ReactElement {
  return (
    <div className={className}>
      {lines.map((line, index) => (
        // Lines have no identity of their own; their order is the key.
        <div key={String(index)}>{line === '' ? ' ' : line}</div>
      ))}
    </div>
  );
}

function StateBody({
  id,
  leaf,
}: {
  id: string;
  leaf: Extract<LeafData, { kind: 'state' }>;
}): ReactElement {
  const [isEditing, done] = useInlineEdit(id);
  const hasDesc: boolean = leaf.desc.length > 0;
  return (
    <>
      <div
        className={cn(
          'grid place-items-center px-3 text-center text-sm leading-[18px] font-medium break-words',
          hasDesc ? 'border-b border-node-stroke pt-2 pb-1.5' : 'flex-1 py-1',
        )}
      >
        {isEditing ? (
          <LabelEditor value={leaf.label} onDone={done} className="w-full text-center" />
        ) : (
          leaf.label
        )}
      </div>
      {hasDesc ? (
        <Lines
          lines={leaf.desc}
          className="flex-1 px-2.5 pt-1 pb-1.5 text-xs leading-4 break-words text-muted-foreground"
        />
      ) : null}
    </>
  );
}

function PseudoShape({ leaf, size }: { leaf: LeafData; size: Size }): ReactElement {
  const { width: w, height: h } = size;
  switch (leaf.kind) {
    case 'start':
      return <circle className="fill-foreground" cx={w * HALF} cy={h * HALF} r={w * HALF - 1} />;
    case 'end':
      return (
        <g>
          <circle
            className="fill-panel stroke-foreground [stroke-width:1.6]"
            cx={w * HALF}
            cy={h * HALF}
            r={w * HALF - END_RING_INSET}
          />
          <circle
            className="fill-foreground"
            cx={w * HALF}
            cy={h * HALF}
            r={w * HALF - END_DOT_INSET}
          />
        </g>
      );
    case 'choice':
      return (
        <polygon
          className="fill-node-fill stroke-node-stroke [stroke-width:1.5]"
          points={`${String(w * HALF)},1 ${String(w - 1)},${String(h * HALF)} ${String(w * HALF)},${String(h - 1)} 1,${String(h * HALF)}`}
        />
      );
    default:
      return (
        <rect className="fill-foreground" x="0.5" y="0.5" width={w - 1} height={h - 1} rx="2" />
      );
  }
}

function leafName(leaf: LeafData): string {
  switch (leaf.kind) {
    case 'state':
    case 'emptyComposite':
      return leaf.label;
    case 'note':
      return `Note on ${leaf.target}`;
    default:
      return leaf.title;
  }
}

type StateLeaf = Extract<LeafData, { kind: 'state' }>;
type NoteLeaf = Extract<LeafData, { kind: 'note' }>;

interface BoxProps<Leaf extends LeafData> {
  id: string;
  leaf: Leaf;
  isSelected: boolean;
}

function StateBox({ id, leaf, isSelected }: BoxProps<StateLeaf>): ReactElement {
  const size: Size = nodeSize(leaf);
  return (
    <div
      data-testid={`state-node-${id}`}
      aria-label={leaf.label}
      className={cn(
        'relative flex flex-col rounded-[12px] border border-node-stroke bg-node-fill text-foreground',
        isSelected && SELECTED_BOX,
      )}
      style={{ width: size.width, height: size.height }}
    >
      <StateBody id={id} leaf={leaf} />
      <StateHandles />
    </div>
  );
}

function PseudoBox({ id, leaf, isSelected }: BoxProps<LeafData>): ReactElement {
  const size: Size = nodeSize(leaf);
  const isLoose: boolean = leaf.kind === 'start' || leaf.kind === 'end' ? leaf.isLoose : false;
  return (
    <div
      data-testid={`state-node-${id}`}
      // A name needs a role to be read out; this box has no text of its own (WCAG 4.1.2).
      role="group"
      aria-label={leafName(leaf)}
      title={leafName(leaf)}
      className={cn(
        'relative',
        isLoose && 'opacity-55',
        isSelected && '[&_svg_*]:stroke-accent-ink [&_svg_*]:[stroke-width:2.5]',
      )}
      style={{ width: size.width, height: size.height }}
    >
      <svg
        aria-hidden="true"
        width={size.width}
        height={size.height}
        className="absolute inset-0 overflow-visible"
      >
        <PseudoShape leaf={leaf} size={size} />
      </svg>
      <StateHandles />
    </div>
  );
}

function LeafNodeView({ id, data, selected: isSelected }: NodeProps<StateLeafNode>): ReactElement {
  const { leaf } = data;
  if (leaf.kind === 'state') {
    return <StateBox id={id} leaf={leaf} isSelected={isSelected} />;
  }
  if (leaf.kind === 'note') {
    return <NoteBox id={id} leaf={leaf} isSelected={isSelected} />;
  }
  return <PseudoBox id={id} leaf={leaf} isSelected={isSelected} />;
}

/** A plain state (title and description), a pseudo state (start, end, choice, fork, join) or a note. */
export const StateLeafView: NamedExoticComponent<NodeProps<StateLeafNode>> = memo(LeafNodeView);

function CompositeView({
  id,
  data,
  selected: isSelected,
}: NodeProps<CompositeFlowNode>): ReactElement {
  const [isEditing, done] = useInlineEdit(id);
  return (
    <div
      data-testid={`state-node-${id}`}
      aria-label={`Composite ${data.label}`}
      className={cn(
        'relative rounded-[14px] border border-node-stroke bg-node-fill/50 text-foreground',
        isSelected && SELECTED_BOX,
      )}
      style={{ width: data.width, height: data.height }}
    >
      <div
        className={cn(
          'flex h-[26px] items-center border-b border-node-stroke/60 px-3 text-xs font-semibold',
          data.isEmpty && 'border-dashed',
        )}
      >
        {isEditing ? (
          <LabelEditor value={data.label} onDone={done} className="w-full text-left text-xs" />
        ) : (
          <span className="truncate">{data.label}</span>
        )}
      </div>
      <StateHandles />
    </div>
  );
}

/** A composite's frame around what it holds, or an empty composite drawn as a box of its own. */
export const CompositeNodeView: NamedExoticComponent<NodeProps<CompositeFlowNode>> =
  memo(CompositeView);

function RegionView({ id, data }: NodeProps<RegionFlowNode>): ReactElement {
  return (
    <div
      data-testid={`state-region-${id}`}
      className="pointer-events-none rounded-track border border-dashed border-node-stroke/70"
      style={{ width: data.width, height: data.height }}
    />
  );
}

/** A concurrent region inside a composite: a dashed box, never selected. */
export const RegionNodeView: NamedExoticComponent<NodeProps<RegionFlowNode>> = memo(RegionView);

/** A folded-corner box, drawn on the half pixel so the 1.2 px stroke stays crisp. */
function notePaths(width: number, height: number): { body: string; fold: string } {
  const right: string = String(width - HALF);
  const fold: string = String(width - NOTE_FOLD);
  const corner: string = String(NOTE_FOLD);
  return {
    body: `M${String(HALF)},${String(HALF)} H${fold} L${right},${corner} V${String(height - HALF)} H${String(HALF)} Z`,
    fold: `M${fold},${String(HALF)} V${corner} H${right}`,
  };
}

/** A note: a folded-corner box beside its state. */
function NoteBox({ id, leaf, isSelected }: BoxProps<NoteLeaf>): ReactElement {
  const [isEditing, done] = useInlineEdit(id);
  const { width, height } = nodeSize(leaf);
  return (
    <div
      data-testid={`state-node-${id}`}
      aria-label={`Note on ${leaf.target}`}
      className="relative"
      style={{ width, height }}
    >
      <svg
        aria-hidden="true"
        width={width}
        height={height}
        className={cn(
          'absolute inset-0 overflow-visible fill-warning-bg stroke-warning [stroke-width:1.2]',
          isSelected && 'stroke-accent-ink [stroke-width:2]',
        )}
      >
        <path d={notePaths(width, height).body} />
        <path className="fill-none" d={notePaths(width, height).fold} />
      </svg>
      {isEditing ? (
        <LabelEditor
          value={leaf.text}
          onDone={done}
          isMultiline
          className="m-1 w-[calc(100%-8px)] text-left text-xs"
        />
      ) : (
        <Lines
          lines={leaf.text.split('\n')}
          className="relative px-2.5 pt-[7px] pb-1.5 text-xs leading-4 break-words text-foreground"
        />
      )}
      <StateHandles isConnectable={false} />
    </div>
  );
}
