// Block frames (loop, alt, opt, par, critical, break, rect): the frame, its name tab, the first
// section's condition and the dashed dividers of `else` / `and` / `option` sections.
import { BLOCKS } from '@nautink/editors/sequence/constants';
import { linesOf } from '@nautink/editors/sequence/layout';
import { cn } from '@nautink/ui/lib/utils';

import { tabPath } from './sequence-geometry.ts';
import { dragOffset, isEditing, isSelected } from './sequence-scene.ts';
import { translate } from './svg-path.ts';

import type { CanvasHandlers, CanvasScene } from './sequence-scene.ts';
import type { BlockBox } from '@nautink/editors/sequence/layout';
import type { ReactElement } from 'react';

const HEAD_H: number = 22;
const TAB_TEXT_X: number = 7;
const TAB_TEXT_Y: number = 10;
const CONDITION_GAP: number = 8;
const SECTION_TEXT_X: number = 10;
const SECTION_TEXT_Y: number = 14;
const RECT_TEXT_X: number = 6;

interface BlockProps {
  block: BlockBox;
  scene: CanvasScene;
  handlers: CanvasHandlers;
}

function SectionDividers({ block, scene, handlers }: BlockProps): ReactElement {
  const { item } = block;
  const keyword: string = BLOCKS[item.kind].more ?? 'else';
  return (
    <>
      {block.sections.slice(1).map((section) => (
        <g key={section.k}>
          <line
            x1={block.x1}
            x2={block.x2}
            y1={section.y}
            y2={section.y}
            className="stroke-edge [stroke-dasharray:5_4]"
          />
          <text
            x={block.x1 + SECTION_TEXT_X}
            y={section.y + SECTION_TEXT_Y}
            dominantBaseline="central"
            className="cursor-pointer fill-foreground text-xs italic"
            onPointerDown={(event) => {
              handlers.onItemDown(event, item.id);
            }}
            onDoubleClick={() => {
              handlers.onEdit({ kind: 'section', id: item.id, sectionIndex: section.k });
            }}
          >
            {isEditing(scene, { kind: 'section', id: item.id, sectionIndex: section.k })
              ? ''
              : `${keyword} [${section.label}]`}
          </text>
        </g>
      ))}
    </>
  );
}

function BlockTab({ block, scene }: Omit<BlockProps, 'handlers'>): ReactElement {
  const { item } = block;
  if (item.kind === 'rect') {
    return (
      <text
        x={block.x1 + RECT_TEXT_X}
        y={block.y1 + TAB_TEXT_Y}
        dominantBaseline="central"
        className="fill-muted-foreground text-[11px] font-medium"
      >
        rect
      </text>
    );
  }
  const condition: string = item.sections[0]?.label ?? '';
  const isConditionShown: boolean =
    condition !== '' && !isEditing(scene, { kind: 'section', id: item.id, sectionIndex: 0 });
  return (
    <>
      <path
        d={tabPath(block.x1, block.y1, block.tabW)}
        className="fill-muted stroke-edge [stroke-width:1.2]"
      />
      <text
        x={block.x1 + TAB_TEXT_X}
        y={block.y1 + TAB_TEXT_Y}
        dominantBaseline="central"
        className="fill-foreground text-[11px] font-semibold"
      >
        {BLOCKS[item.kind].name.toLowerCase()}
      </text>
      {isConditionShown ? (
        <text
          x={block.x1 + block.tabW + CONDITION_GAP}
          y={block.y1 + TAB_TEXT_Y}
          dominantBaseline="central"
          className="fill-foreground text-xs italic"
        >
          {`[${linesOf(condition).join(' ')}]`}
        </text>
      ) : null}
    </>
  );
}

function BlockFrame({ block, scene, handlers }: BlockProps): ReactElement {
  const { item } = block;
  const isOn: boolean = isSelected(scene, 'items', item.id);
  const offset: number = dragOffset(scene, item.id);
  return (
    <g
      data-testid={`sequence-item-${item.id}`}
      className={cn(offset !== 0 && 'opacity-55')}
      {...(offset === 0 ? {} : { transform: translate(0, offset) })}
    >
      <rect
        x={block.x1}
        y={block.y1}
        width={block.x2 - block.x1}
        height={block.y2 - block.y1}
        className={cn(
          'pointer-events-none fill-none [stroke-width:1.2]',
          isOn ? 'stroke-accent-ink [stroke-width:2]' : 'stroke-edge',
          item.kind === 'rect' && !isOn && 'opacity-60 [stroke-dasharray:2_3]',
        )}
      />
      <SectionDividers block={block} scene={scene} handlers={handlers} />
      <g
        className="cursor-grab"
        onPointerDown={(event) => {
          handlers.onItemDown(event, item.id);
        }}
        onDoubleClick={() => {
          if (item.kind !== 'rect') {
            handlers.onEdit({ kind: 'section', id: item.id, sectionIndex: 0 });
          }
        }}
      >
        <rect
          x={block.x1}
          y={block.y1}
          width={block.x2 - block.x1}
          height={HEAD_H}
          className="fill-transparent"
        />
        <BlockTab block={block} scene={scene} />
      </g>
    </g>
  );
}

/** Every block's frame; the block is grabbed by its head row. */
export function BlockFrames({
  scene,
  handlers,
}: {
  scene: CanvasScene;
  handlers: CanvasHandlers;
}): ReactElement {
  return (
    <g>
      {scene.layout.blocks.map((block) => (
        <BlockFrame key={block.item.id} block={block} scene={scene} handlers={handlers} />
      ))}
    </g>
  );
}
