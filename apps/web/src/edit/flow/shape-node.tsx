import { labelLines, NO_LABEL, nodeSize } from '@nautink/editors/flow/size';
import { cn } from '@nautink/ui/lib/utils';
import { Handle, Position } from '@xyflow/react';
import { memo, useEffect, useRef, useState } from 'react';

import { useFlowEditorContext } from './flow-context.ts';
import { ShapeOutline } from './shape-outline.tsx';
import { IconGlyph } from '../icons/icon-glyph.tsx';

import type { ShapeFlowNode } from './flow-types.ts';
import type { FlowNode } from '@nautink/editors/flow/model';
import type { Size } from '@nautink/visual-core/geometry';
import type { NodeProps } from '@xyflow/react';
import type { KeyboardEvent, NamedExoticComponent, ReactElement, RefObject } from 'react';

const SIDES: readonly (readonly [string, Position])[] = [
  ['t', Position.Top],
  ['r', Position.Right],
  ['b', Position.Bottom],
  ['l', Position.Left],
];

/** A dot on each side: drag from one to connect (links attach to the facing sides). */
export function Handles(): ReactElement {
  return (
    <>
      {SIDES.map(([id, position]) => (
        <Handle key={id} id={id} type="source" position={position} />
      ))}
    </>
  );
}

/** React Flow keeps a new node hidden until measured, so focus is retried for a moment. */
const FOCUS_RETRY_MS: number = 1500;

function useFocusWhenShown(ref: RefObject<HTMLTextAreaElement | null>): void {
  useEffect(() => {
    const until: number = performance.now() + FOCUS_RETRY_MS;
    let frame: number = 0;
    const tick = (): void => {
      const element: HTMLTextAreaElement | null = ref.current;
      element?.focus();
      if (element !== null && document.activeElement === element) {
        element.select();
      } else if (performance.now() < until) {
        frame = requestAnimationFrame(tick);
      }
    };
    tick();
    return (): void => {
      cancelAnimationFrame(frame);
    };
  }, [ref]);
}

/** Inline label editing (double-click or Enter): Enter saves, Shift+Enter breaks a line, Esc cancels. */
function LabelEditor({
  value,
  onDone,
}: {
  value: string;
  onDone: (text: string | null) => void;
}): ReactElement {
  const [text, setText] = useState<string>(value);
  const ref: RefObject<HTMLTextAreaElement | null> = useRef<HTMLTextAreaElement>(null);
  useFocusWhenShown(ref);
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    event.stopPropagation();
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onDone(text);
    } else if (event.key === 'Escape') {
      onDone(null);
    }
  };
  return (
    <textarea
      ref={ref}
      aria-label="Node label"
      value={text}
      rows={Math.max(1, text.split('\n').length)}
      className="nodrag nopan nowheel relative z-10 w-[calc(100%-12px)] resize-none rounded-control border border-ring bg-panel px-1 text-center text-sm outline-none"
      onChange={(event) => {
        setText(event.target.value);
      }}
      onBlur={() => {
        onDone(text);
      }}
      onKeyDown={onKeyDown}
    />
  );
}

function Lines({ label, className }: { label: string; className?: string }): ReactElement {
  return (
    <div className={className}>
      {labelLines(label).map((line, index) => (
        // Lines have no identity of their own; their order is the key.
        <div key={String(index)}>{line === '' ? ' ' : line}</div>
      ))}
    </div>
  );
}

const ICON_DEFAULT: number = 48;
const FRAMED_ICON_SHARE: number = 0.62;
const BARE_ICON_SHARE: number = 0.9;

const FRAME_CLASS: Readonly<Record<string, string>> = {
  square: 'rounded-xs border border-node-stroke bg-node-fill',
  rounded: 'rounded-card border border-node-stroke bg-node-fill',
  circle: 'rounded-full border border-node-stroke bg-node-fill',
};

function iconShare(form: string): number {
  return form === '' ? BARE_ICON_SHARE : FRAMED_ICON_SHARE;
}

function Picture({ node }: { node: FlowNode }): ReactElement {
  const box: number = node.h ?? ICON_DEFAULT;
  const form: string = node.form ?? '';
  if (node.img !== undefined) {
    return (
      <img
        src={node.img}
        alt=""
        width={node.w ?? box}
        height={box}
        draggable={false}
        className="shrink-0 object-contain"
      />
    );
  }
  return (
    <div
      className={cn('grid shrink-0 place-items-center', FRAME_CLASS[form])}
      style={{ width: box, height: box }}
    >
      <IconGlyph name={node.icon ?? ''} size={Math.round(box * iconShare(form))} />
    </div>
  );
}

/** An icon or image node: the picture, with its label above or below (v1's `AssetNode`). */
function AssetBody({ node }: { node: FlowNode }): ReactElement {
  const label: ReactElement | null =
    node.label === '' ? null : (
      <Lines label={node.label} className="text-center text-xs leading-[18px]" />
    );
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5">
      {node.pos === 't' ? label : null}
      <Picture node={node} />
      {node.pos === 't' ? null : label}
    </div>
  );
}

function isAssetNode(node: FlowNode): boolean {
  return node.icon !== undefined || node.img !== undefined;
}

/** What a node shows: the inline label editor, or its picture or label. */
function NodeContent({ id, node }: { id: string; node: FlowNode }): ReactElement | null {
  const { editingId, setEditingId, renameNode, isReadOnly } = useFlowEditorContext();
  if (editingId === id && !isReadOnly) {
    return (
      <LabelEditor
        value={labelLines(node.label).join('\n')}
        onDone={(text) => {
          setEditingId(null);
          if (text !== null) {
            renameNode(id, text.split('\n').join('<br>'));
          }
        }}
      />
    );
  }
  if (isAssetNode(node)) {
    return <AssetBody node={node} />;
  }
  return NO_LABEL.has(node.shape) ? null : (
    <Lines
      label={node.label}
      className="relative max-w-full px-3 text-center text-sm font-medium break-words"
    />
  );
}

function ShapeNodeView({ id, data, selected: isSelected }: NodeProps<ShapeFlowNode>): ReactElement {
  const { node } = data;
  const size: Size = nodeSize(node);
  const isAsset: boolean = isAssetNode(node);
  return (
    <div
      data-testid={`flow-node-${id}`}
      aria-label={node.label === '' ? id : node.label}
      className={cn(
        'relative grid place-items-center text-foreground',
        isAsset && 'rounded-control',
        isAsset && isSelected && 'ring-2 ring-accent-ink ring-offset-2 ring-offset-background',
      )}
      style={{ width: size.width, height: size.height }}
    >
      {isAsset ? null : (
        <ShapeOutline
          shape={node.shape}
          width={size.width}
          height={size.height}
          isSelected={isSelected}
        />
      )}
      <NodeContent id={id} node={node} />
      <Handles />
    </div>
  );
}

/** One flowchart node: its shape (or icon/image), its label, and its handles. */
export const ShapeNode: NamedExoticComponent<NodeProps<ShapeFlowNode>> = memo(ShapeNodeView);
