import { approximateTextWidth } from '@nautink/visual-core/text-measure';
import { describe, expect, it } from 'vitest';

import { entityLayout, FONTS, HEADER_H, ROW_H } from './size.ts';

import type { ErEntity } from './model.ts';

const measure = (text: string): number => approximateTextWidth(text);
const blank: ErEntity = { name: 'A', alias: '', attributes: [], classes: [] };

describe('entityLayout', () => {
  it('gives an empty entity the minimum box', () => {
    expect(entityLayout(blank, measure)).toEqual({
      width: 150,
      height: HEADER_H + 6,
      cols: { type: 0, name: 0, keys: 0, comment: 0 },
    });
  });

  it('sizes the attribute columns and gives spare width to the name column', () => {
    const entity: ErEntity = {
      ...blank,
      attributes: [
        { type: 'int', name: 'id', keys: ['PK', 'FK'], comment: '' },
        { type: 'string', name: 'email', keys: [], comment: 'x'.repeat(40) },
      ],
    };
    expect(entityLayout(entity, measure)).toEqual({
      width: 371,
      height: HEADER_H + 2 * ROW_H + 4,
      cols: { type: 62, name: 55, keys: 54, comment: 200 },
    });
    expect(entityLayout({ ...entity, attributes: [entity.attributes[0]!] }, measure).cols).toEqual({
      type: 41,
      name: 55,
      keys: 54,
      comment: 0,
    });
  });

  it('makes room for the alias and the name under it', () => {
    const fonts: string[] = [];
    const layout = entityLayout(
      { ...blank, name: 'CUSTOMER', alias: 'A very long customer alias' },
      (text, font) => {
        fonts.push(font);
        return measure(text);
      },
    );
    expect(layout.width).toBe(282);
    expect(fonts).toEqual([FONTS.title, FONTS.subtitle]);
  });
});
