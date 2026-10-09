import { updateNode } from './flow-actions.ts';
import { ChoiceField, CommitField } from '../canvas/inspector-fields.tsx';
import { IconGlyph } from '../icons/icon-glyph.tsx';

import type { FlowActionContext } from './flow-actions.ts';
import type { Choice } from '../canvas/inspector-fields.tsx';
import type { FlowNode } from '@nautink/editors/flow/model';
import type { ReactElement } from 'react';

type Frame = 'square' | 'rounded' | 'circle' | 'none';
type LabelSide = 'b' | 't';
type AssetSize = '32' | '48' | '72' | '96';

const FRAMES: readonly Choice<Frame>[] = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Round' },
  { value: 'circle', label: 'Circle' },
  { value: 'none', label: 'None' },
];

const SIDES: readonly Choice<LabelSide>[] = [
  { value: 'b', label: 'Below' },
  { value: 't', label: 'Above' },
];

const SIZES: readonly Choice<AssetSize>[] = [
  { value: '32', label: 'S', name: 'Small' },
  { value: '48', label: 'M', name: 'Medium' },
  { value: '72', label: 'L', name: 'Large' },
  { value: '96', label: 'XL', name: 'Extra large' },
];

const DEFAULT_BOX: number = 48;

/** The node's `form`: '' draws the icon without a frame. */
function formOf(frame: Frame): string {
  return frame === 'none' ? '' : frame;
}

function frameOf(node: FlowNode): Frame {
  return FRAMES.find((frame) => frame.value === node.form)?.value ?? 'none';
}

function sizeOf(node: FlowNode): AssetSize {
  return SIZES.find((size) => Number(size.value) === (node.h ?? DEFAULT_BOX))?.value ?? '48';
}

/** A new height; an image keeps its aspect ratio (v1). */
function resized(node: FlowNode, height: number): Partial<FlowNode> {
  const width: number | null | undefined = node.w;
  const box: number = node.h ?? DEFAULT_BOX;
  return node.img !== undefined && typeof width === 'number'
    ? { h: height, w: Math.round((width / box) * height) }
    : { h: height };
}

function PictureField({
  node,
  context,
}: {
  node: FlowNode;
  context: FlowActionContext;
}): ReactElement {
  if (node.icon === undefined) {
    return (
      <CommitField
        label="Image URL"
        value={node.img ?? ''}
        onCommit={(text) => {
          if (text.trim() !== '') {
            updateNode(context, node.id, { img: text.trim() });
          }
        }}
      />
    );
  }
  return (
    <div className="flex items-end gap-2">
      <IconGlyph name={node.icon} size={32} className="mb-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <CommitField
          label="Icon"
          value={node.icon}
          placeholder="pack:name"
          onCommit={(text) => {
            if (text.includes(':')) {
              updateNode(context, node.id, { icon: text.trim() });
            }
          }}
        />
      </div>
    </div>
  );
}

/** Icon and image nodes: the picture, its frame, where the label goes, and the size (v1). */
export function AssetFields({
  node,
  context,
}: {
  node: FlowNode;
  context: FlowActionContext;
}): ReactElement {
  return (
    <>
      <PictureField node={node} context={context} />
      {node.icon === undefined ? null : (
        <ChoiceField
          label="Frame"
          value={frameOf(node)}
          choices={FRAMES}
          onChange={(frame) => {
            updateNode(context, node.id, { form: formOf(frame) });
          }}
        />
      )}
      <ChoiceField
        label="Label"
        value={node.pos === 't' ? 't' : 'b'}
        choices={SIDES}
        onChange={(pos) => {
          updateNode(context, node.id, { pos });
        }}
      />
      <ChoiceField
        label="Size"
        value={sizeOf(node)}
        choices={SIZES}
        onChange={(size) => {
          updateNode(context, node.id, resized(node, Number(size)));
        }}
      />
    </>
  );
}
