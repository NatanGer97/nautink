// Text edited in place on the canvas (v1's `InlineEditor` and `commitText`): where the field goes,
// what it starts with, and the edit it makes.
import { HEAD_H } from '@nautink/editors/sequence/layout';
import { findItem } from '@nautink/editors/sequence/model';

import { setSectionLabel, updateItem, updateParticipant } from './sequence-actions.ts';
import { headerTop } from './sequence-geometry.ts';

import type { SequenceActionContext } from './sequence-actions.ts';
import type { EditTarget } from './sequence-types.ts';
import type { BlockBox, Column, Row, SequenceLayout } from '@nautink/editors/sequence/layout';
import type { SequenceItem, SequenceModel } from '@nautink/editors/sequence/types';

const HALF: number = 0.5;
const NAME_W: number = 120;
const FIELD_HALF_H: number = 14;
const SECTION_W: number = 160;
const SECTION_PAD: number = 8;
const TAB_GAP: number = 4;
const SECTION_LEFT: number = 6;
const MESSAGE_W: number = 160;
const MESSAGE_INSET: number = 20;
const MESSAGE_UP: number = 34;
const SELF_LEFT: number = 8;
const NOTE_W: number = 140;
const SECTION_NUDGE: number = 2;

/** The inline field's spot (canvas coordinates) and its starting text. */
export interface InlineField {
  x: number;
  y: number;
  w: number;
  value: string;
}

/** `<br>` as new lines, for a textarea. */
export function toLines(text: string): string {
  return text.replace(/<br\s*\/?>/gi, '\n');
}

/** New lines as `<br>`, for Mermaid. */
export function fromLines(text: string): string {
  return text.split('\n').join('<br>');
}

function participantField(layout: SequenceLayout, id: string): InlineField | null {
  const col: Column | undefined = layout.cols.find((item) => item.id === id);
  if (col === undefined) {
    return null;
  }
  const w: number = Math.max(col.w, NAME_W);
  const y: number = headerTop(layout, col) + HEAD_H[col.p.kind] * HALF - FIELD_HALF_H;
  return { x: col.x - w * HALF, y, w, value: toLines(col.p.label) };
}

function sectionField(block: BlockBox, sectionIndex: number): InlineField | null {
  const section: BlockBox['sections'][number] | undefined = block.sections[sectionIndex];
  if (section === undefined) {
    return null;
  }
  const isFirst: boolean = sectionIndex === 0;
  const x: number = isFirst ? block.x1 + block.tabW + TAB_GAP : block.x1 + SECTION_LEFT;
  const y: number = isFirst ? block.y1 - SECTION_NUDGE : section.y + SECTION_NUDGE;
  return { x, y, w: Math.max(SECTION_W, block.x2 - x - SECTION_PAD), value: section.label };
}

function rowField(row: Row): InlineField | null {
  const item: SequenceItem = row.item;
  if (item.t === 'note' && row.nx1 !== undefined && row.nx2 !== undefined) {
    const w: number = Math.max(NOTE_W, row.nx2 - row.nx1);
    return { x: row.nx1, y: row.ny ?? row.y, w, value: toLines(item.text) };
  }
  if (item.t !== 'msg' || row.ay === undefined || row.x1 === undefined || row.x2 === undefined) {
    return null;
  }
  const w: number = Math.max(MESSAGE_W, Math.abs(row.x2 - row.x1) - MESSAGE_INSET);
  const middle: number =
    row.isSelf === true ? row.x1 + SELF_LEFT + w * HALF : (row.x1 + row.x2) * HALF;
  return { x: middle - w * HALF, y: row.ay - MESSAGE_UP, w, value: toLines(item.text) };
}

/** Where the inline field for `target` goes; null when the target is not on the canvas. */
export function inlineField(layout: SequenceLayout, target: EditTarget): InlineField | null {
  if (target.kind === 'participant') {
    return participantField(layout, target.id);
  }
  if (target.kind === 'section') {
    const block: BlockBox | undefined = layout.blocks.find((item) => item.item.id === target.id);
    return block === undefined ? null : sectionField(block, target.sectionIndex);
  }
  const row: Row | undefined = layout.rows.find((item) => item.item.id === target.id);
  return row === undefined ? null : rowField(row);
}

function commitParticipant(context: SequenceActionContext, id: string, text: string): void {
  const label: string = fromLines(text).trim() || id;
  const participant: SequenceModel['participants'][number] | undefined = context
    .getModel()
    ?.participants.find((item) => item.id === id);
  if (participant !== undefined && participant.label !== label) {
    updateParticipant(context, id, { label });
  }
}

function commitRowText(context: SequenceActionContext, id: string, text: string): void {
  const model: SequenceModel | null = context.getModel();
  const item: SequenceItem | undefined = model === null ? undefined : findItem(model, id)?.item;
  const next: string = fromLines(text);
  if ((item?.t === 'msg' || item?.t === 'note') && item.text !== next) {
    updateItem(context, id, { text: next });
  }
}

function commitSection(
  context: SequenceActionContext,
  target: { id: string; sectionIndex: number },
  label: string,
): void {
  const model: SequenceModel | null = context.getModel();
  const item: SequenceItem | undefined =
    model === null ? undefined : findItem(model, target.id)?.item;
  if (item?.t === 'block' && item.sections[target.sectionIndex]?.label !== label) {
    setSectionLabel(context, { blockId: target.id, sectionIndex: target.sectionIndex, label });
  }
}

/** Writes the inline field's text (only when it changed) and closes the field. */
export function commitText(context: SequenceActionContext, target: EditTarget, text: string): void {
  context.edit(null);
  if (target.kind === 'participant') {
    commitParticipant(context, target.id, text);
  } else if (target.kind === 'section') {
    commitSection(context, target, text.replace(/\n/g, ' '));
  } else {
    commitRowText(context, target.id, text);
  }
}
