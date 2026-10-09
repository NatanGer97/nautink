// Entity box geometry, shared by the node renderer, layout and link routing so they agree exactly.
// Text is measured by an injected measurer (a canvas in the browser).
import { displayName } from './model.ts';

import type { ErAttribute, ErEntity } from './model.ts';
import type { TextMeasurer } from '@nautink/visual-core/text-measure';

export const FONT: string = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
export const HEADER_H: number = 32;
export const ROW_H: number = 22;

// Horizontal padding per column, one key badge (gap included), and box limits.
const PAD: number = 10;
const BADGE_W: number = 22;
const MIN_W: number = 150;
const MAX_COMMENT: number = 180;
const HEAD_PAD: number = 28;
const SUB_PAD: number = 16;
const ROWS_PAD: number = 4;
const EMPTY_PAD: number = 6;
const BOTH_SIDES: number = 2;

/** The fonts entity boxes use, by text role. */
export const FONTS: Readonly<Record<'type' | 'name' | 'comment' | 'title' | 'subtitle', string>> = {
  type: `12px ${FONT}`,
  name: `600 12px ${FONT}`,
  comment: `italic 11px ${FONT}`,
  title: `600 13px ${FONT}`,
  subtitle: `11px ${FONT}`,
};

/** Column widths of the attribute table (0 when a column is hidden). */
export interface EntityColumns {
  type: number;
  name: number;
  keys: number;
  comment: number;
}

export interface EntityLayout {
  width: number;
  height: number;
  cols: EntityColumns;
}

function widest(widths: readonly number[]): number {
  return Math.max(0, ...widths);
}

function textColumn(texts: readonly string[], font: string, measure: TextMeasurer): number {
  if (texts.length === 0) {
    return 0;
  }
  return Math.ceil(widest(texts.map((text: string) => measure(text, font))) + PAD * BOTH_SIDES);
}

function commentColumn(attributes: readonly ErAttribute[], measure: TextMeasurer): number {
  if (!attributes.some((attribute: ErAttribute) => attribute.comment)) {
    return 0;
  }
  const width: number = widest(
    attributes.map((attribute: ErAttribute) => measure(attribute.comment, FONTS.comment)),
  );
  return Math.ceil(Math.min(MAX_COMMENT, width) + PAD * BOTH_SIDES);
}

function columns(entity: ErEntity, measure: TextMeasurer): EntityColumns {
  const { attributes } = entity;
  const keyCount: number = widest(
    attributes.map((attribute: ErAttribute) => attribute.keys.length),
  );
  return {
    type: textColumn(
      attributes.map((attribute: ErAttribute) => attribute.type),
      FONTS.type,
      measure,
    ),
    name: textColumn(
      attributes.map((attribute: ErAttribute) => attribute.name),
      FONTS.name,
      measure,
    ),
    keys: keyCount ? keyCount * BADGE_W + PAD : 0,
    comment: commentColumn(attributes, measure),
  };
}

/** Size of an entity box and its attribute columns. Spare width goes to the name column. */
export function entityLayout(entity: ErEntity, measure: TextMeasurer): EntityLayout {
  const cols: EntityColumns = columns(entity, measure);
  const head: number = Math.ceil(measure(displayName(entity), FONTS.title) + HEAD_PAD);
  const sub: number = entity.alias ? Math.ceil(measure(entity.name, FONTS.subtitle) + SUB_PAD) : 0;
  const table: number = cols.type + cols.name + cols.keys + cols.comment;
  const width: number = Math.max(MIN_W, head + sub, table);
  const hasRows: boolean = entity.attributes.length > 0;
  return {
    width: Math.round(width),
    height: HEADER_H + (hasRows ? entity.attributes.length * ROW_H + ROWS_PAD : EMPTY_PAD),
    cols: { ...cols, name: cols.name + (hasRows ? width - table : 0) },
  };
}
